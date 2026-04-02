import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Direction } from '@common/direction';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket, MessageBody, OnGatewayDisconnect, OnGatewayInit,
    SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly gameLogicService: GameLogicService,
        private readonly lobbyService: LobbyService,
    ) {}

    afterInit() {
        this.logger.log('GameGateway initialized on /join namespace');
        this.gameLogicService.setCallbacks({
            onBetweenTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.BetweenTurnCountdown, secondsLeft);
            },
            onTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnCountdown, secondsLeft);
            },
            onTurnStarted: (lobbyId: string, playerSocketId: string) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnStarted, playerSocketId);
                this.sendMovementPoints(lobbyId, playerSocketId);
                this.sendActionPoints(lobbyId, playerSocketId);
                this.sendReachableTiles(lobbyId, playerSocketId);
                this.sendReachableTilesForTeleport(lobbyId, playerSocketId);
                this.autoEndTurnIfNoActions(lobbyId, playerSocketId);
            },
            onTurnEnded: (lobbyId: string, playerSocketId: string) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnEnded, playerSocketId);
            },
        });
    }

    handleDisconnect(socket: Socket) {
        this.processGameDisconnect(socket);
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const finalLobby = this.lobbyService.canStartGame(lobbyId, socket.id);
        if (!finalLobby) {
            socket.emit(JoinGameEvents.LobbyError, `Impossible de demarrer la partie. (Minimum 2 joueurs requis.)`);
            return;
        }

        finalLobby.players.map(p => {
            p.flagsCaptured = 0;
        });
        
        const activeGame = this.gameLogicService.initializeGame(finalLobby);

        this.server.to(lobbyId).emit(JoinGameEvents.GameStarting, activeGame.lobby);

        this.server.to(lobbyId).emit(JoinGameEvents.GameStarted, {
            lobby: activeGame.lobby,
            turnOrder: activeGame.turnOrder,
            playerPositions: this.gameLogicService.getPlayerPositions(lobbyId),
        });

        this.gameLogicService.startTurnCycle(lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.RequestMove)
    handleRequestMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; direction: Direction }) {
        const { lobbyId, direction } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result = this.gameLogicService.movePlayer(lobbyId, socket.id, direction);
        if (!result) return;

        const movementPoints = this.gameLogicService.getMovementPoints(lobbyId, socket.id);
        this.server.to(lobbyId).emit(JoinGameEvents.PlayerMoved, {
            socketId: socket.id,
            position: result.position,
            movementPoints,
            flagTaken: result.flagJustTaken,
        });

        this.sendReachableTiles(lobbyId, socket.id);
        this.sendReachableTilesForTeleport(lobbyId, socket.id);
        this.autoEndTurnIfNoActions(lobbyId, socket.id);
    }

    @SubscribeMessage(JoinGameEvents.Teleport)
    handleTeleportMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; position: Vec2 }) {
        const { lobbyId, position } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const newPosition = this.gameLogicService.teleportPlayer(lobbyId, socket.id, position);
        if (!newPosition) return;

        this.server.to(lobbyId).emit(JoinGameEvents.PlayerTeleported, {
            socketId: socket.id,
            position: newPosition,
        });

        this.sendReachableTiles(lobbyId, socket.id);
        this.sendReachableTilesForTeleport(lobbyId, socket.id);
        this.autoEndTurnIfNoActions(lobbyId, socket.id);
    }

    @SubscribeMessage(JoinGameEvents.ToggleDebugMode)
    handleDebugToggle(@ConnectedSocket() socket: Socket, @MessageBody() { lobbyId, state }) {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame || activeGame.lobby.hostSocketId !== socket.id) return;
        activeGame.isDebugMode = !state;
        this.server.to(lobbyId).emit(JoinGameEvents.DebugToggled, !state);

        if (!activeGame.isDebugMode) {
            const currentSocketId = activeGame.turnOrder[activeGame.currentTurnIndex];
            if (currentSocketId) {
                this.autoEndTurnIfNoActions(lobbyId, currentSocketId);
            }
        }
    }

    @SubscribeMessage(JoinGameEvents.EndTurn)
    handleEndTurn(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (activeGame.lobby.hostSocketId === socket.id || this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }

    @SubscribeMessage(JoinGameEvents.RequestCombat)
    handleRequestCombat(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string, targetSocketId: string }) {
        const { lobbyId, targetSocketId } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const combatResult = this.gameLogicService.initiateCombat(lobbyId, socket.id, targetSocketId);
        if (!combatResult) return;

        this.sendActionPoints(lobbyId, socket.id);
        this.server.to(lobbyId).emit(JoinGameEvents.CombatResult, combatResult);

        const winner = this.gameLogicService.checkWinCondition(lobbyId);
        if (winner) {
            this.handleGameOver(lobbyId, winner.socketId);
            return;
        }

        this.gameLogicService.endTurn(lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.TransferFlag)
    handleTransferFlag(@ConnectedSocket() socket: Socket, @MessageBody() payload: {lobbyId: string, targetSocketId: string}) {
        const { lobbyId, targetSocketId } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const wasFlagTransfered = this.gameLogicService.transferFlag(lobbyId, socket.id, targetSocketId);
        if (!wasFlagTransfered) return;

        const flagTransferData = {
            giverPlayerId: socket.id,
            targetPlayerId: targetSocketId,
        };

        this.sendActionPoints(lobbyId, socket.id);
        this.server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, flagTransferData);
    }

    @SubscribeMessage(JoinGameEvents.RequestTileInfo)
    handleRequestTileInfo(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; position: Vec2 }) {
        const { lobbyId, position } = payload;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const tile = activeGame.lobby.game.grid[position.y]?.[position.x];
        if (!tile) return;

        const playerOnTile = activeGame.lobby.players.find((p) => {
            const pPos = activeGame.playerPositions.get(p.socketId);
            return pPos && pPos.x === position.x && pPos.y === position.y && !p.hasAbandonned;
        });

        socket.emit(JoinGameEvents.TileInfo, {
            tile,
            cost: TILE_COSTS[tile.type],
            player: playerOnTile ? { name: playerOnTile.character.name, avatar: playerOnTile.character.avatar } : null,
        });
    }

    @SubscribeMessage(JoinGameEvents.PlayerAbandon)
    handlePlayerAbandon(@ConnectedSocket() socket: Socket) {
        this.processGameDisconnect(socket);
        socket.emit(JoinGameEvents.LeftLobby);
    }

    private processGameDisconnect(socket: Socket) {
        const activeGame = this.gameLogicService.findActiveGameBySocketId(socket.id);
        if (!activeGame) return;

        const isGameOver = this.gameLogicService.executePlayerAbandon(
            activeGame.lobby.lobbyId,
            socket,
            this.server,
        );

        if (isGameOver) {
            this.lobbyService.deleteLobby(activeGame.lobby.lobbyId);
        }
    }

    private handleGameOver(lobbyId: string, winnerSocketId: string | null): void {
        this.server.to(lobbyId).emit(JoinGameEvents.GameOver, { winnerSocketId, isForfeit: false });
        this.gameLogicService.endGame(lobbyId);
        this.lobbyService.deleteLobby(lobbyId);
        this.server.in(lobbyId).socketsLeave(lobbyId);
    }

    private autoEndTurnIfNoActions(lobbyId: string, socketId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (activeGame?.isDebugMode) return;

        const movementPoints = this.gameLogicService.getMovementPoints(lobbyId, socketId);
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        if (movementPoints <= 0 || actionPoints <= 0) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }

    private sendMovementPoints(lobbyId: string, socketId: string): void {
        const mp = this.gameLogicService.getMovementPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.MovementPoints, { socketId, movementPoints: mp });
    }

    private sendActionPoints(lobbyId: string, socketId: string): void {
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ActionPoints, { socketId, actionPoints });
    }

    private sendReachableTiles(lobbyId: string, socketId: string): void {
        const reachableTiles = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ReachableTiles, {
            socketId,
            tiles: reachableTiles,
        });
    }

    private sendReachableTilesForTeleport(lobbyId: string, socketId: string): void {
        const reachableTiles = this.gameLogicService.getReachableTilesForTeleport(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ReachableTilesForTeleport, {
            socketId,
            tiles: reachableTiles,
        });
    }
}
