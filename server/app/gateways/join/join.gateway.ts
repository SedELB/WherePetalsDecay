import { Game } from '@app/model/schema/game.schema';
import { SocketNamespace } from '@common/enums';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinGameEvents } from './join.gateway.events';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class JoinGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    afterInit() {
        this.logger.log('JoinGateway initialized on join namespace');

    }

    handleConnection(socket: Socket) {
        this.logger.log(`Player client connected: ${socket.id}`);
        
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Player client disconnected: ${socket.id}`);
    }

    notifyGameHosted(game: Game) {
        this.server.emit(JoinGameEvents.GameHosted, game);
    }

    notifyGameClosed(gameId: string) {
        this.server.emit(JoinGameEvents.GameFull, gameId);
    }

    notifyGameDeleted(gameId: string) {
        this.server.emit(JoinGameEvents.GameDeleted, gameId);
    }
}
