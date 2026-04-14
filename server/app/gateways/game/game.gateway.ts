import { CombatInitiationGateway } from '@app/gateways/combat/combat-initiation.gateway';
import { CombatResolutionGateway } from '@app/gateways/combat/combat-resolution.gateway';
import { CombatSessionService } from '@app/gateways/combat/combat-session.service';
import { GameTurnSyncService } from '@app/gateways/game/game-turn-sync.service';
import { MovementGateway } from '@app/gateways/game/movement.gateway';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { VirtualPlayerService } from '@app/services/game-logic/virtual-player.service';
import { JournalService } from '@app/services/journal/journal.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { PlayerType, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    @Inject(Logger) private readonly logger: Logger;
    @Inject(CombatSessionService) private readonly combatSessionService: CombatSessionService;
    @Inject(CombatResolutionGateway) private readonly combatResolutionGateway: CombatResolutionGateway;
    @Inject(CombatInitiationGateway) private readonly combatInitiationGateway: CombatInitiationGateway;
    @Inject(MovementGateway) private readonly movementGateway: MovementGateway;
    private readonly endGamePlayers = new Map<string, Set<string>>();

    constructor(
        private readonly gameLogicService: GameLogicService,
        private readonly lobbyService: LobbyService,
        private readonly gameTurnSyncService: GameTurnSyncService,
        private readonly virtualPlayerService: VirtualPlayerService,
        private readonly journalService: JournalService,
    ) {}

    afterInit(): void {
        this.logger.log('GameGateway initialized on /join namespace');

        this.combatResolutionGateway.setHandleGameOverCallback(this.handleGameOver.bind(this));
        this.movementGateway.setHandleGameOverCallback(this.handleGameOver.bind(this));

        this.gameLogicService.setCallbacks({
            onBetweenTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.BetweenTurnCountdown, secondsLeft);
            },
            onTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnCountdown, secondsLeft);
            },
            onTurnStarted: (lobbyId: string, playerSocketId: string) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnStarted, playerSocketId);
                this.gameTurnSyncService.syncPlayerTurnStateWithoutAutoEnd(this.server, lobbyId, playerSocketId);
                setImmediate(() => {
                    this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, playerSocketId);
                    this.triggerVirtualPlayerTurnIfNeeded(lobbyId, playerSocketId);
                });
                this.server.to(lobbyId).emit(JoinGameEvents.SanctuaryStateUpdate, {
                    inactiveSanctuaries: this.gameLogicService.getInactiveSanctuaries(lobbyId),
                });

                const activeGame = this.gameLogicService.getActiveGame(lobbyId);
                const playerName = activeGame?.lobby.players.find((p) => p.socketId === playerSocketId)?.character?.name ?? 'Joueur inconnu';
                this.journalService.addTurnStartEntry(lobbyId, playerName);
            },
            onTurnEnded: (lobbyId: string, playerSocketId: string) => {
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
            },
        });
    }

    handleDisconnect(socket: Socket): void {
        this.processGameDisconnect(socket);
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        const finalLobby = this.lobbyService.canStartGame(lobbyId, socket.id);
        if (!finalLobby) {
            socket.emit(JoinGameEvents.LobbyError, 'Impossible de demarrer la partie. (Minimum 2 joueurs requis.)');
            return;
        }

        const activeGame = this.gameLogicService.initializeGame(finalLobby);

        this.server.to(lobbyId).emit(JoinGameEvents.GameStarting, activeGame.lobby);
        this.server.to(lobbyId).emit(JoinGameEvents.GameStarted, {
            lobby: activeGame.lobby,
            turnOrder: activeGame.turnOrder,
            playerPositions: this.gameLogicService.getPlayerPositions(lobbyId),
            playerStartPositions: activeGame.playerStartPositions,
        });

        this.gameLogicService.startTurnCycle(lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.ToggleDebugMode)
    handleDebugToggle(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; state: boolean }): void {
        const { lobbyId, state } = payload;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame || activeGame.lobby.hostSocketId !== socket.id) return;

        activeGame.isDebugMode = !state;
        this.server.to(lobbyId).emit(JoinGameEvents.DebugToggled, !state);

        const hostName = activeGame.lobby.players.find((p) => p.socketId === socket.id)?.character?.name ?? 'Hôte';
        this.journalService.addDebugToggleEntry(lobbyId, hostName, activeGame.isDebugMode);

        if (!activeGame.isDebugMode) {
            const currentSocketId = activeGame.turnOrder[activeGame.currentTurnIndex];
            if (currentSocketId) {
                this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, currentSocketId);
            }
        }
    }

    @SubscribeMessage(JoinGameEvents.EndTurn)
    handleEndTurn(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        if (activeGame.lobby.hostSocketId === socket.id || this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }

    @SubscribeMessage(JoinGameEvents.PlayerAbandon)
    handlePlayerAbandon(@ConnectedSocket() socket: Socket): void {
        this.processGameDisconnect(socket);
        socket.emit(JoinGameEvents.LeftLobby);
    }

    @SubscribeMessage(JoinGameEvents.LeaveEndGame)
    handleLeaveEndGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        const remaining = this.endGamePlayers.get(lobbyId);
        if (!remaining) return;

        remaining.delete(socket.id);
        socket.leave(lobbyId);

        if (remaining.size > 0) return;
        this.endGamePlayers.delete(lobbyId);
        this.lobbyService.deleteLobby(lobbyId);
    }

    private processGameDisconnect(socket: Socket): void {
        const activeGame = this.gameLogicService.findActiveGameBySocketId(socket.id);
        if (!activeGame) return;

        const lobbyId = activeGame.lobby.lobbyId;
        const abandoningPlayer = activeGame.lobby.players.find((p) => p.socketId === socket.id);
        if (abandoningPlayer) {
            this.journalService.addPlayerAbandonEntry(lobbyId, abandoningPlayer.character.name);
        }

        const combatSession = this.combatSessionService.findCombatSessionByPlayer(socket.id);
        if (combatSession) {
            const winnerId = combatSession.attackerId === socket.id ? combatSession.defenderId : combatSession.attackerId;
            this.combatResolutionGateway.resolveCombatByAbandon(combatSession, socket.id, winnerId);
        }

        const isGameOver = this.gameLogicService.executePlayerAbandon(lobbyId, socket, this.server);
        if (!isGameOver) return;

        const remainingPlayers = activeGame.lobby.players
            .filter((player) => !player.hasAbandonned)
            .map((player) => player.socketId);
        this.endGamePlayers.set(lobbyId, new Set(remainingPlayers));
    }

    private handleGameOver(lobbyId: string, winnerSocketId: string | null): void {
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

    // Called from 'onTurnStarted'. If the player whose turn just started is a
    // virtual player, we delegate the entire turn to VirtualPlayerService.
    private triggerVirtualPlayerTurnIfNeeded(lobbyId: string, playerSocketId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const currentPlayer = activeGame.lobby.players.find((p) => p.socketId === playerSocketId);
        if (!currentPlayer || currentPlayer.playerType !== PlayerType.Virtual) return;

        this.virtualPlayerService.executeTurn(
            this.server,
            activeGame,
            currentPlayer,
            this.combatInitiationGateway.initiateVirtualPlayerCombat.bind(this.combatInitiationGateway),
            this.handleGameOver.bind(this),
        );
    }
}
