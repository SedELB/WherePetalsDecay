import { ChatMessagePayload } from '@app/interfaces/gateway.interfaces';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { ChatMessage } from '@common/chat-message';
import { MAX_MESSAGE_LENGTH } from '@common/constants/validation.constants';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export { ChatMessagePayload };

@Injectable()
export class ChatFlowService {
    @Inject() private readonly lobbyService: LobbyService;

    handleMessage(server: Server, socket: Socket, payload: ChatMessagePayload): void {
        const lobbyId = payload.lobbyId;
        if (!lobbyId) return;
        if (!socket.rooms.has(lobbyId)) return;

        const message = (payload.message ?? '').slice(0, MAX_MESSAGE_LENGTH);
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
        server.to(lobbyId).emit(JoinGameEvents.ReceivedChatMessage, chatMessage);
    }

    handleHistoryRequest(socket: Socket, lobbyId: string): void {
        const lobby = this.lobbyService.getLobby(lobbyId);
        if (!lobby) return;
        socket.emit(JoinGameEvents.ChatHistorySent, lobby.chatHistory);
    }
}
