import { SocketNamespace } from '@common/enums';
import { WaitingRoomEvents } from '@common/waiting-room-events';
import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type ChatMessagePayload = {
    roomId: string;
    characterName: string;
    message: string;
    sentAt: number;
};

@WebSocketGateway({ namespace: SocketNamespace.WaitingRoom, cors: true })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    private static readonly MAX_MESSAGE_LENGTH = 200;

    afterInit() {
        this.logger.log('ChatGateway initialized on chat namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Chat client connected: ${socket.id}`);
        socket.on(WaitingRoomEvents.JoinRoom, async (payload: { roomId: string; characterName?: string }) => {
            const roomId = payload?.roomId?.trim();
            if (!roomId) return;

            await socket.join(roomId);

            this.server.to(roomId).emit(WaitingRoomEvents.PlayerJoined, {
                roomId,
                socketId: socket.id,
                characterName: payload?.characterName?.trim() || 'Joueur',
                sentAt: Date.now(),
            });
        });

        socket.on(WaitingRoomEvents.LeaveRoom, async (payload: { roomId: string; characterName?: string }) => {
            const roomId = payload?.roomId?.trim();
            if (!roomId) return;

            await socket.leave(roomId);

            // broadcast aux autres membres seulement (pas au client qui quitte)
            socket.to(roomId).emit(WaitingRoomEvents.PlayerLeft, {
                roomId,
                socketId: socket.id,
                characterName: payload?.characterName?.trim() || 'Joueur',
                sentAt: Date.now(),
            });
        });

        socket.on(WaitingRoomEvents.ChatSendMessage, (payload: { roomId: string; message: string; characterName?: string }) => {
            const roomId = payload?.roomId?.trim();
            if (!roomId) return;

            if (!socket.rooms.has(roomId)) return;

            const rawMessage = payload.message;
            const message = rawMessage.trim().slice(0, ChatGateway.MAX_MESSAGE_LENGTH);
            if (!message) return;

            const chatMessage: ChatMessagePayload = {
                roomId,
                characterName: payload?.characterName?.trim() || 'Joueur',
                message,
                sentAt: Date.now(),
            };

            // Envoie à tout le monde dans la room (incluant l'émetteur)
            this.server.to(roomId).emit(WaitingRoomEvents.ChatMessage, chatMessage);
        });

        socket.on('disconnect', () => {
            this.logger.log(`Chat client disconnected (socket.io): ${socket.id}`);
        });
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Chat client disconnected: ${socket.id}`);
    }
}
