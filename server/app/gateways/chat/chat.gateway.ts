import { SocketNamespace } from '@common/enums';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinGameEvents } from '@common/join.gateway.events';
import { ChatMessage } from '@common/chat-message';
import { LobbyService } from '@app/services/lobby/lobby.service';

const MAX_MESSAGE_LENGTH = 200;


@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class ChatGateway {
    @WebSocketServer() private server: Server;

    constructor(private readonly lobbyService: LobbyService) {}

    @SubscribeMessage(JoinGameEvents.ChatSendMessage)
    handleChatMessage(@ConnectedSocket() socket : Socket, @MessageBody() payload: { lobbyId: string, message: string, senderName: string }){
        
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

        // Envoie à tout le monde dans la room (incluant l'émetteur)
        this.server.to(lobbyId).emit(JoinGameEvents.ReceivedChatMessage, chatMessage);
    }

    @SubscribeMessage(JoinGameEvents.ChatHistoryRequest)
    handleChatHistoryRequest(@ConnectedSocket() socket : Socket, @MessageBody() lobbyId: string) {
        if (!socket.rooms.has(lobbyId)) return;

        const chatHistory = this.lobbyService.getLobby(lobbyId).chatHistory;
        if (!chatHistory) return;

        socket.emit(JoinGameEvents.ChatHistorySent, chatHistory);
    }
}
