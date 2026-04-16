import { ToggleDebugPayload } from '@app/interfaces/gateway.interfaces';
import { CombatFlowService } from '@app/services/game-logic/core/combat-flow.service';
import { CombatStateService } from '@app/services/game-logic/core/combat-state.service';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { GameTurnSyncService } from '@app/services/game-logic/core/game-turn-sync.service';
import { JournalService } from '@app/services/journal/journal.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { COMBAT_POST_ABANDON_RESUME_DELAY_MS } from '@common/constants/combat-timeline.constants';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class GameFlowService {
    @Inject(LobbyService) private readonly lobbyService: LobbyService;
    @Inject(JournalService) private readonly journalService: JournalService;

    private readonly endGamePlayers = new Map<string, Set<string>>();
    private server: Server;

    constructor(
        private readonly gameLogicService: GameLogicService,
        private readonly combatFlowService: CombatFlowService,
        private readonly combatState: CombatStateService,
        private readonly gameTurnSyncService: GameTurnSyncService,
    ) {}

    initialize(server: Server): void {
        this.server = server;
        this.combatFlowService.initialize(server, this.gameTurnSyncService, this.handleGameOver.bind(this));
        this.gameLogicService.setCallbacks({
            onBetweenTurnCountdown: (lobbyId, secondsLeft) => server.to(lobbyId).emit(JoinGameEvents.BetweenTurnCountdown, secondsLeft),
            onTurnCountdown: (lobbyId, secondsLeft) => server.to(lobbyId).emit(JoinGameEvents.TurnCountdown, secondsLeft),
            onTurnStarted: (lobbyId, playerSocketId) => this.emitTurnStarted(lobbyId, playerSocketId),
            onTurnEnded: (lobbyId, playerSocketId) => this.emitTurnEnded(lobbyId, playerSocketId),
        });
    }

    startGame(socket: Socket, lobbyId: string): void {
        const finalLobby = this.lobbyService.canStartGame(lobbyId, socket.id);
        if (!finalLobby) {
            socket.emit(JoinGameEvents.LobbyError, 'Impossible de demarrer la partie. (Minimum 2 joueurs requis.)');
            return;
        }

        this.combatState.clearPendingPostCombatTurnResume(lobbyId);
        const activeGame = this.gameLogicService.initializeGame(finalLobby);

        this.server.to(lobbyId).emit(JoinGameEvents.GameStarting, activeGame.lobby);
        this.server.to(lobbyId).emit(JoinGameEvents.GameStarted, {
            lobby: activeGame.lobby,
            turnOrder: activeGame.turnOrder,
            playerPositions: this.gameLogicService.getPlayerPositions(lobbyId),
            playerStartPositions: this.gameLogicService.getPlayerStartPositions(lobbyId),
        });

        this.gameLogicService.startTurnCycle(lobbyId);
    }

    toggleDebug(socket: Socket, payload: ToggleDebugPayload): void {
        const { lobbyId, state } = payload;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame || activeGame.lobby.hostSocketId !== socket.id) return;

        const newDebugState = !state;
        this.gameLogicService.setDebugMode(lobbyId, newDebugState);
        this.server.to(lobbyId).emit(JoinGameEvents.DebugToggled, newDebugState);

        const hostName = this.gameLogicService.getPlayerName(lobbyId, socket.id, 'Hôte');
        this.journalService.addDebugToggleEntry(lobbyId, hostName, newDebugState);

        if (!newDebugState) {
            const currentSocketId = activeGame.turnOrder[activeGame.currentTurnIndex];
            if (currentSocketId) this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, currentSocketId);
        }
    }

    endTurn(socket: Socket, lobbyId: string): void {
        if (this.combatState.hasActiveCombatInLobby(lobbyId)) return;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;
        if (activeGame.lobby.hostSocketId === socket.id || this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }

    playerAbandon(socket: Socket): void {
        this.processGameDisconnect(socket);
        socket.emit(JoinGameEvents.LeftLobby);
    }

    processGameDisconnect(socket: Socket): void {
        const activeGame = this.gameLogicService.findActiveGameBySocketId(socket.id);
        if (!activeGame) return;

        const lobbyId = activeGame.lobby.lobbyId;
        const abandoningPlayer = activeGame.lobby.players.find((p) => p.socketId === socket.id);
        if (abandoningPlayer) this.journalService.addPlayerAbandonEntry(lobbyId, abandoningPlayer.character.name);

        const combatSession = this.combatState.findCombatSessionByPlayer(socket.id);
        const shouldDeferTurnAdvance = Boolean(combatSession) && this.gameLogicService.isPlayerTurn(lobbyId, socket.id);

        if (combatSession) {
            const winnerId = combatSession.attackerId === socket.id ? combatSession.defenderId : combatSession.attackerId;
            this.combatFlowService.resolveCombatByAbandon(combatSession, socket.id, winnerId);
        }

        const abandonResult = this.gameLogicService.executePlayerAbandon(lobbyId, socket.id, shouldDeferTurnAdvance);

        if (abandonResult.updatedLobby) {
            this.server.to(lobbyId).emit(JoinGameEvents.PlayerAbandoned, { socketId: socket.id, updatedLobby: abandonResult.updatedLobby });
        }
        socket.leave(lobbyId);

        if (!abandonResult.isGameOver && shouldDeferTurnAdvance) {
            this.combatState.schedulePostCombatTurnResume(lobbyId, COMBAT_POST_ABANDON_RESUME_DELAY_MS, () => {
                this.gameLogicService.endTurn(lobbyId);
            });
        }

        if (!abandonResult.isGameOver) return;

        this.server.to(lobbyId).emit(JoinGameEvents.GameOver, abandonResult.gameOverPayload);
        const remainingPlayers = activeGame.lobby.players
            .filter((player) => !player.hasAbandonned)
            .map((player) => player.socketId);
        this.endGamePlayers.set(lobbyId, new Set(remainingPlayers));
    }

    leaveEndGame(socket: Socket, lobbyId: string): void {
        const remaining = this.endGamePlayers.get(lobbyId);
        if (!remaining) return;

        remaining.delete(socket.id);
        socket.leave(lobbyId);

        if (remaining.size > 0) return;
        this.endGamePlayers.delete(lobbyId);
        this.lobbyService.deleteLobby(lobbyId);
    }

    handleGameOver(lobbyId: string, winnerSocketId: string | null): void {
        this.combatState.clearPendingPostCombatTurnResume(lobbyId);

        const gameStats = this.gameLogicService.getGameStats(lobbyId);
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const players = activeGame ? [...activeGame.lobby.players] : [];
        const socketIds = new Set(players.map((player) => player.socketId));
        this.endGamePlayers.set(lobbyId, socketIds);

        const activeNames = players.filter((p) => !p.hasAbandonned).map((p) => p.character.name);
        this.journalService.addGameOverEntry(lobbyId, activeNames);

        this.server.to(lobbyId).emit(JoinGameEvents.GameOver, { winnerSocketId, isForfeit: false, players, gameStats });
        this.gameLogicService.endGame(lobbyId);
    }

    private emitTurnStarted(lobbyId: string, playerSocketId: string): void {
        this.server.to(lobbyId).emit(JoinGameEvents.TurnStarted, playerSocketId);
        this.gameTurnSyncService.syncPlayerTurnStateWithoutAutoEnd(this.server, lobbyId, playerSocketId);
        setImmediate(() => {
            this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, playerSocketId);
            this.combatFlowService.triggerVirtualPlayerTurnIfNeeded(lobbyId, playerSocketId);
        });
        this.server.to(lobbyId).emit(JoinGameEvents.SanctuaryStateUpdate, {
            inactiveSanctuaries: this.gameLogicService.getInactiveSanctuaries(lobbyId),
        });

        const playerName = this.gameLogicService.getPlayerName(lobbyId, playerSocketId, 'Joueur inconnu');
        this.journalService.addTurnStartEntry(lobbyId, playerName);
    }

    private emitTurnEnded(lobbyId: string, playerSocketId: string): void {
        const expiredBonusPlayers = this.gameLogicService.decrementSanctuaryCooldowns(lobbyId, playerSocketId);
        for (const sid of expiredBonusPlayers) {
            const game = this.gameLogicService.getActiveGame(lobbyId);
            const player = game?.lobby.players.find((p) => p.socketId === sid);
            if (player) {
                this.server.to(lobbyId).emit(JoinGameEvents.PlayerStatsUpdate, {
                    socketId: sid,
                    attack: player.character.attack,
                    defense: player.character.defense,
                    life: player.character.life,
                });
            }
        }
        this.server.to(lobbyId).emit(JoinGameEvents.TurnEnded, playerSocketId);
    }
}
