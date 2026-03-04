import { Game } from '@app/model/schema/game.schema';
import { SocketNamespace } from '@common/enums';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlayerGameEvents } from './games.gateway.events';

@WebSocketGateway({ namespace: SocketNamespace.Games, cors: true })
@Injectable()
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {
    }

    afterInit() {
        this.logger.log('GamesGateway initialized on /games namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Player client connected: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Player client disconnected: ${socket.id}`);
    }

    notifyGameCreated(game: Game) {
        this.server.emit(PlayerGameEvents.GameCreated, game);
    }

    notifyGameDeleted(gameId: string) {
        this.server.emit(PlayerGameEvents.GameDeleted, gameId);
    }

    notifyGameVisibilityChanged(gameId: string, isVisible: boolean) {
        this.server.emit(PlayerGameEvents.GameVisibilityChanged, { gameId, isVisible });
    }

}
