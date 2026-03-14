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
            onTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnCountdown, secondsLeft);
            },
            onTurnStarted: (lobbyId: string, playerSocketId: string) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnStarted, playerSocketId);
                this.sendMovementPoints(lobbyId, playerSocketId);
                this.sendReachableTiles(lobbyId, playerSocketId);
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

        finalLobby.players = this.gameLogicService.shufflePlayers(finalLobby.players);
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

        const newPosition = this.gameLogicService.movePlayer(lobbyId, socket.id, direction);
        if (!newPosition) return;

        const movementPoints = this.gameLogicService.getMovementPoints(lobbyId, socket.id);
        this.server.to(lobbyId).emit(JoinGameEvents.PlayerMoved, {
            socketId: socket.id,
            position: newPosition,
            movementPoints,
        });

        this.sendReachableTiles(lobbyId, socket.id);

        this.autoEndTurnIfNoActions(lobbyId, socket.id);
    }

    @SubscribeMessage(JoinGameEvents.EndTurn)
    handleEndTurn(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;
        this.gameLogicService.endTurn(lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.RequestCombat)
    handleRequestCombat(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }) {
        const { lobbyId, targetSocketId } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const combatResult = this.gameLogicService.initiateCombat(lobbyId, socket.id, targetSocketId);
        if (!combatResult) return;

        this.server.to(lobbyId).emit(JoinGameEvents.CombatResult, combatResult);

        const winner = this.gameLogicService.checkWinCondition(lobbyId);
        if (winner) {
            this.handleGameOver(lobbyId, winner.socketId);
            return;
        }

        this.gameLogicService.endTurn(lobbyId);
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
        this.server.to(lobbyId).emit(JoinGameEvents.GameOver, { winnerSocketId });
        this.gameLogicService.endGame(lobbyId);
        this.lobbyService.deleteLobby(lobbyId);
        this.server.in(lobbyId).socketsLeave(lobbyId);
    }

    private autoEndTurnIfNoActions(lobbyId: string, socketId: string): void {
        const reachable = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        const adjacent = this.gameLogicService.getAdjacentPlayers(lobbyId, socketId);
        if (reachable.length === 0 && adjacent.length === 0) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }

    private sendMovementPoints(lobbyId: string, socketId: string): void {
        const mp = this.gameLogicService.getMovementPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.MovementPoints, { socketId, movementPoints: mp });
    }

    private sendReachableTiles(lobbyId: string, socketId: string): void {
        const reachableTiles = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ReachableTiles, {
            socketId,
            tiles: reachableTiles,
        });
    }
}
