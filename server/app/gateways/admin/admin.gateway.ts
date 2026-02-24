import { SocketNamespace } from '@common/enums';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminGameEvents } from './admin.gateway.events';
import { Game } from '@app/model/schema/game.schema';

@WebSocketGateway({ namespace: SocketNamespace.Admin, cors: true })
@Injectable()
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    afterInit() {
        this.logger.log('AdminGateway initialized on admin namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Admin client connected: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Admin client disconnected: ${socket.id}`);
    }

    notifyGameCreated(game: Game) {
        this.server.emit(AdminGameEvents.GameCreated, game);
    }

    notifyGameUpdated(game: Game) {
        this.server.emit(AdminGameEvents.GameUpdated, game);
    }

    notifyGameDeleted(gameId: string) {
        this.server.emit(AdminGameEvents.GameDeleted, gameId);
    }

    notifyGameVisibilityChanged(gameId: string, isVisible: boolean) {
        this.server.emit(AdminGameEvents.GameVisibilityChanged, { gameId, isVisible });
    }
}
