import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { PlayerType } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class GameTurnSyncService {
    constructor(private readonly gameLogicService: GameLogicService) {}

    syncPlayerTurnState(server: Server, lobbyId: string, socketId: string): void {
        this.emitMovementPoints(server, lobbyId, socketId);
        this.emitActionPoints(server, lobbyId, socketId);
        this.refreshPlayerNavigationState(server, lobbyId, socketId);
    }

    syncPlayerTurnStateWithoutAutoEnd(server: Server, lobbyId: string, socketId: string): void {
        this.emitMovementPoints(server, lobbyId, socketId);
        this.emitActionPoints(server, lobbyId, socketId);
        this.emitReachableTiles(server, lobbyId, socketId);
        this.emitReachableTilesForTeleport(server, lobbyId, socketId);
    }

    refreshPlayerNavigationState(server: Server, lobbyId: string, socketId: string): void {
        this.emitReachableTiles(server, lobbyId, socketId);
        this.emitReachableTilesForTeleport(server, lobbyId, socketId);
        this.autoEndTurnIfNoActions(lobbyId, socketId);
    }

    emitMovementPoints(server: Server, lobbyId: string, socketId: string): void {
        const movementPoints = this.gameLogicService.getMovementPoints(lobbyId, socketId);
        server.to(lobbyId).emit(JoinGameEvents.MovementPoints, { socketId, movementPoints });
    }

    emitActionPoints(server: Server, lobbyId: string, socketId: string): void {
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        server.to(lobbyId).emit(JoinGameEvents.ActionPoints, { socketId, actionPoints });
    }

    emitReachableTiles(server: Server, lobbyId: string, socketId: string): void {
        const reachableTiles = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        server.to(lobbyId).emit(JoinGameEvents.ReachableTiles, {
            socketId,
            tiles: reachableTiles,
        });
    }

    emitReachableTilesForTeleport(server: Server, lobbyId: string, socketId: string): void {
        const reachableTiles = this.gameLogicService.getReachableTilesForTeleport(lobbyId);
        server.to(lobbyId).emit(JoinGameEvents.ReachableTilesForTeleport, {
            socketId,
            tiles: reachableTiles,
        });
    }

    autoEndTurnIfNoActions(lobbyId: string, socketId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (activeGame?.isDebugMode) return;

        const player = activeGame?.lobby.players.find((p) => p.socketId === socketId);
        if (player?.playerType === PlayerType.Virtual) return;

        const reachableTiles = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        const canMove = reachableTiles.length > 0;

        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        const adjacentPlayers = this.gameLogicService.getAdjacentPlayers(lobbyId, socketId);
        const canAttack = actionPoints > 0 && adjacentPlayers.length > 0;
        const canToggleDoor = this.gameLogicService.canToggleAdjacentDoor(lobbyId, socketId);

        if (!canMove && !canAttack && !canToggleDoor) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }
}
