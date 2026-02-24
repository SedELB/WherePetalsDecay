import { SocketNamespace } from '@common/enums';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatEvents } from './chat.gateway.events';

@WebSocketGateway({ namespace: SocketNamespace.Chat, cors: true })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    afterInit() {
        this.logger.log('ChatGateway initialized on chat namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Chat client connected: ${socket.id}`);
        socket.on(ChatEvents.UserJoinded, () => {
            socket.join("roomXYZ");// J'attend que la vue d'attente soit implementer
        });

        socket.on(ChatEvents.UserLeft, () => {
            socket.leave("roomXYZ");
            socket.to("roomXYX").emit(ChatEvents.UserLeft, { socketId: socket.id });
        });

        socket.on(
            ChatEvents.MessageSent,
            (payload: { roomId: string; message: string; username?: string }) => {
                socket.to(payload.roomId).emit(ChatEvents.MessageSent, {
                    message: payload.message,
                    username: payload.username,
                    senderId: socket.id,
                });
            }
        );

        socket.on('disconnect', () => {
            this.logger.log(`Chat client disconnected (socket.io): ${socket.id}`);
        });
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Chat client disconnected: ${socket.id}`);
    }
}
