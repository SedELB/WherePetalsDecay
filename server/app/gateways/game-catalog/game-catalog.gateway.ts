import { Game } from '@app/model/schema/game.schema';
import { SocketNamespace } from '@common/enums';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameCreationEvents } from '@common/socket-events/games.gateway.events';

@WebSocketGateway({ namespace: SocketNamespace.Games, cors: true })
@Injectable()
export class GameCatalogGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    @Inject(Logger) private readonly logger: Logger;

    afterInit() {
        this.logger.log('GameCatalogGateway initialized on /games namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Player client connected: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Player client disconnected: ${socket.id}`);
    }

    notifyGameCreated(game: Game) {
        this.server.emit(GameCreationEvents.GameCreated, game);
    }

    notifyGameDeleted(gameId: string) {
        this.server.emit(GameCreationEvents.GameDeleted, gameId);
    }

    notifyGameVisibilityChanged(gameId: string, isVisible: boolean) {
        this.server.emit(GameCreationEvents.GameVisibilityChanged, { gameId, isVisible });
    }

}
