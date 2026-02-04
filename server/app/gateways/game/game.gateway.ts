import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEvents } from './game.gateway.events';

@WebSocketGateway({ cors: true })
@Injectable()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    afterInit() {
        this.logger.log('GameGateway initialized');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Game client connected: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Game client disconnected: ${socket.id}`);
    }

    notifyGameCreated(game: unknown) {
        this.server.emit(GameEvents.GameCreated, game);
    }

    notifyGameUpdated(game: unknown) {
        this.server.emit(GameEvents.GameUpdated, game);
    }

    notifyGameDeleted(gameId: string) {
        this.server.emit(GameEvents.GameDeleted, gameId);
    }

    notifyGameVisibilityChanged(gameId: string, isVisible: boolean) {
        this.server.emit(GameEvents.GameVisibilityChanged, { gameId, isVisible });
    }

    notifyGamesUpdated() {
        this.server.emit(GameEvents.GamesUpdated);
    }
}