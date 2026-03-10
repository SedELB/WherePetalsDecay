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

    private readonly messagesByRoom = new Map<string, BehaviorSubject<ChatMessage[]>>();

    constructor(private readonly webSocketService: WebSocketService) {

        this.webSocketService.onNamespace<ChatMessage>(this.namespace, JoinGameEvents.ReceivedChatMessage, (msg) => {
            const messages = this.getAllMessagesByRoom(msg.lobbyId);
            messages.next([...messages.value, msg]);
        });
    }

    roomMessages$(roomId: string): Observable<ChatMessage[]> {
        return this.getAllMessagesByRoom(roomId).asObservable();
    }

    sendMessage(lobbyId: string, playerName: string | undefined, message: string): void {
        if (!lobbyId) return;

        const trimmed = (message ?? '').trim().slice(0, MAX_LENGHT_MESSAGE);
        if (!trimmed) return;
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.ChatSendMessage, {
            lobbyId,
            message: trimmed,
            characterName: playerName?.trim(),
        });
    }

    private getAllMessagesByRoom(lobbyId: string): BehaviorSubject<ChatMessage[]> {
        const chatMessages = this.messagesByRoom.get(lobbyId);
        if (chatMessages) return chatMessages;

        const subject = new BehaviorSubject<ChatMessage[]>([]);
        this.messagesByRoom.set(lobbyId, subject);
        return subject;
    }
}

