import { CombatInitiationGateway } from '@app/gateways/combat/combat-initiation.gateway';
import { CombatSession, CombatSessionService } from '@app/gateways/combat/combat-session.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { VirtualPlayerService } from '@app/services/game-logic/virtual-player.service';
import { JournalService } from '@app/services/journal/journal.service';
import { PlayerType, SocketNamespace } from '@common/enums';
import { CombatEndedData, CombatLockStateData, CombatResult } from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class CombatResolutionGateway {
    @WebSocketServer() private server: Server;

    private handleGameOverCallback: ((lobbyId: string, winnerSocketId: string | null) => void) | null = null;

    constructor(
        private readonly combatSessionService: CombatSessionService,
        @Inject(forwardRef(() => CombatInitiationGateway))
        private readonly combatInitiationGateway: CombatInitiationGateway,
        private readonly gameLogicService: GameLogicService,
        private readonly virtualPlayerService: VirtualPlayerService,
        private readonly journalService: JournalService,
    ) {}

    setHandleGameOverCallback(callback: (lobbyId: string, winnerSocketId: string | null) => void): void {
        this.handleGameOverCallback = callback;
    }

    handleCombatEnd(session: CombatSession, combatResult: CombatResult): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        const attackerName = activeGame?.lobby.players.find((p) => p.socketId === session.attackerId)?.character?.name ?? 'Attaquant';
        const defenderName = activeGame?.lobby.players.find((p) => p.socketId === session.defenderId)?.character?.name ?? 'Défenseur';
        const winnerName = combatResult.winnerId === session.attackerId ? attackerName : defenderName;
        const loserName = combatResult.winnerId === session.attackerId ? defenderName : attackerName;
        this.journalService.addCombatEndEntry(session.lobbyId, winnerName, loserName);

        const combatEndedData: CombatEndedData = {
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
            attackerKilled: combatResult.attacker.killed,
            defenderKilled: combatResult.defender.killed,
            winnerId: combatResult.winnerId,
            reason: 'death',
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatEnded, combatEndedData);

        this.finalizeCombatSession(session, combatResult);
    }

    resolveCombatByAbandon(session: CombatSession, loserId: string, winnerId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) {
            this.emitCombatLockState(this.server, {
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
            this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
            return;
        }

        const winnerPlayer = activeGame.lobby.players.find((player) => player.socketId === winnerId);
        if (winnerPlayer && !winnerPlayer.hasAbandonned) winnerPlayer.winsCount++;

        const combatEndedData: CombatEndedData = {
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
            attackerKilled: loserId === session.attackerId,
            defenderKilled: loserId === session.defenderId,
            winnerId,
            reason: 'abandon',
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatEnded, combatEndedData);

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        this.emitCombatLockState(this.server, {
            lobbyId: session.lobbyId,
            isLocked: false,
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
        });

        if (winner) {
            this.handleGameOverCallback?.(session.lobbyId, winner.socketId);
            this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
            return;
        }

        if (winnerId === session.attackerId) {
            this.gameLogicService.resumeTurnCycle(session.lobbyId);
            this.sendActionPoints(session.lobbyId, session.attackerId);
            this.triggerVirtualPlayerTurnIfNeeded(session.lobbyId, session.attackerId);
            this.autoEndTurnIfNoActions(session.lobbyId, session.attackerId);
        }

        this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
    }

    emitCombatLockState(server: Server, data: CombatLockStateData): void {
        server.to(data.lobbyId).emit(JoinGameEvents.CombatLockStateChanged, data);
    }

    private finalizeCombatSession(session: CombatSession, finalResult: CombatResult): void {
        this.combatSessionService.clearCombatSessionTimers(session);
        this.emitCombatLockState(this.server, {
            lobbyId: session.lobbyId,
            isLocked: false,
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
        });

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        if (winner) {
            this.handleGameOverCallback?.(session.lobbyId, winner.socketId);
            this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
            return;
        }

        if (finalResult.winnerId === session.attackerId) {
            this.gameLogicService.resumeTurnCycle(session.lobbyId);
            this.sendActionPoints(session.lobbyId, session.attackerId);
            this.triggerVirtualPlayerTurnIfNeeded(session.lobbyId, session.attackerId);
            this.autoEndTurnIfNoActions(session.lobbyId, session.attackerId);
        } else {
            this.gameLogicService.endTurn(session.lobbyId);
        }

        this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
    }

    private sendActionPoints(lobbyId: string, socketId: string): void {
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ActionPoints, { socketId, actionPoints });
    }

    private autoEndTurnIfNoActions(lobbyId: string, socketId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (activeGame?.isDebugMode) return;

        const player = activeGame?.lobby.players.find((p) => p.socketId === socketId);
        if (player?.playerType === PlayerType.Virtual) return;

        const reachable = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        const adjacent = this.gameLogicService.getAdjacentPlayers(lobbyId, socketId);
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        const canToggleDoor = this.gameLogicService.canToggleAdjacentDoor(lobbyId, socketId);

        const canMove = reachable.length > 0;
        const canFight = adjacent.length > 0 && actionPoints > 0;

        if (!canMove && !canFight && !canToggleDoor) this.gameLogicService.endTurn(lobbyId);
    }

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
            this.handleGameOverCallback ?? (() => { /* noop fallback */ }),
        );
    }
}
