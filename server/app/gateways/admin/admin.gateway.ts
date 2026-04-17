import { Game } from '@app/model/schema/game.schema';
import { SocketNamespace } from '@common/enums';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminGameEvents } from '@common/socket-events/admin.gateway.events';

@WebSocketGateway({ namespace: SocketNamespace.Admin, cors: true })
@Injectable()
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    @Inject(Logger) private readonly logger: Logger;

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

    notifyGamesUpdated() {
        this.server.emit(AdminGameEvents.GamesUpdated);
    }
}
