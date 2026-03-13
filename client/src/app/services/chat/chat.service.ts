import { Injectable } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { ChatMessage } from '@common/chat-message';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { BehaviorSubject, Observable } from 'rxjs';

const MAX_LENGHT_MESSAGE = 200;

@Injectable({
    providedIn: 'root',
})
export class ChatService {
    private readonly namespace = SocketNamespace.Join;

    private readonly chatHistorySubject = new BehaviorSubject<ChatMessage[]>([]);
    chatHistory$ = this.chatHistorySubject.asObservable();

    constructor(private readonly webSocketService: WebSocketService) {
        this.webSocketService.onNamespace<ChatMessage>(this.namespace, JoinGameEvents.ReceivedChatMessage, (msg) => {
            this.chatHistorySubject.next([...this.chatHistorySubject.getValue(), msg]);
        });

        this.webSocketService.onNamespace<ChatMessage[]>(this.namespace, JoinGameEvents.ChatHistorySent, (chatHistory) => {
            this.chatHistorySubject.next(chatHistory);
        });
    }

    requestHistory(lobbyId: string): void {
        if (!lobbyId) return;
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.ChatHistoryRequest, lobbyId);
    }

    roomMessages$(lobbyId: string): Observable<ChatMessage[]> {
        this.requestHistory(lobbyId);
        return this.chatHistory$;
    }

    sendMessage(lobbyId: string, playerName: string | undefined, message: string): void {
        if (!lobbyId) return;

        const trimmed = (message ?? '').trim().slice(0, MAX_LENGHT_MESSAGE);
        if (!trimmed) return;
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.ChatSendMessage, {
            lobbyId,
            message: trimmed,
            senderName: playerName?.trim(),
        });
    }
}

