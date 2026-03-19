import { LobbyService } from '@app/services/lobby/lobby.service';
import { ChatMessage } from '@common/chat-message';
import { MAX_MESSAGE_LENGTH } from '@common/constants/validation.constants';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class ChatGateway {
    @WebSocketServer() private server: Server;

    constructor(private readonly lobbyService: LobbyService) {}

    @SubscribeMessage(JoinGameEvents.ChatSendMessage)
    handleChatMessage(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; message: string; senderName: string }): void {
        const lobbyId = payload.lobbyId;
        if (!lobbyId) return;

        if (!socket.rooms.has(lobbyId)) return;

        const rawMessage = payload.message;
        const message = rawMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!message) return;

        const lobby = this.lobbyService.getLobby(lobbyId);
        if (!lobby) return;

        const chatMessage: ChatMessage = {
            lobbyId,
            senderName: payload?.senderName?.trim() || 'Joueur',
            message,
            sentAt: new Date(),
        };
        this.lobbyService.saveMessage(lobbyId, chatMessage);

        this.server.to(lobbyId).emit(JoinGameEvents.ReceivedChatMessage, chatMessage);
    }

    @SubscribeMessage(JoinGameEvents.ChatHistoryRequest)
    handleChatHistoryRequest(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        if (!socket.rooms.has(lobbyId)) return;

        const lobby = this.lobbyService.getLobby(lobbyId);
        if (!lobby) return;

        socket.emit(JoinGameEvents.ChatHistorySent, lobby.chatHistory);
    }
}
