import { Injectable } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { WaitingRoomEvents } from '@common/waiting-room-events';
import { BehaviorSubject, Observable } from 'rxjs';

export type ChatMessage = {
    roomId: string;
    characterName: string;
    message: string;
    sentAt: number;
};

@Injectable({
    providedIn: 'root',
})
export class ChatService {
    private readonly namespace = SocketNamespace.WaitingRoom;
    private readonly connectedSubject = new BehaviorSubject<boolean>(false);
    readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();

    private readonly messagesByRoom = new Map<string, BehaviorSubject<ChatMessage[]>>();

    constructor(private readonly webSocketService: WebSocketService) {
        this.webSocketService.connectNamespace(this.namespace);

        this.webSocketService.onNamespace(this.namespace, 'connect', () => {
            this.connectedSubject.next(true);
        });

        this.webSocketService.onNamespace(this.namespace, 'disconnect', () => {
            this.connectedSubject.next(false);
        });

        this.webSocketService.onNamespace<ChatMessage>(this.namespace, WaitingRoomEvents.ChatMessage, (msg) => {
            const subject = this.getAllMessagesByRoom(msg?.roomId);
            subject.next([...subject.value, msg]);
        });
    }

    roomMessages$(roomId: string): Observable<ChatMessage[]> {
        return this.getAllMessagesByRoom(roomId).asObservable();
    }

    joinRoom(roomId: string, playerName: string | undefined): void {
        const roomIdTrimmed = roomId?.trim();
        if (!roomIdTrimmed) return;

        this.webSocketService.emitNamespace(this.namespace, WaitingRoomEvents.JoinRoom, {
            roomId: roomIdTrimmed,
            characterName: playerName?.trim()
        });
    }

    leaveRoom(roomId: string, playerName: string | undefined): void {
        const roomIdTrimmed = roomId?.trim();
        if (!roomIdTrimmed) return;

        this.webSocketService.emitNamespace(this.namespace, WaitingRoomEvents.LeaveRoom, {
            roomId: roomIdTrimmed,
            characterName: playerName?.trim()
        });
    }

    sendMessage(roomId: string, playerName: string | undefined, message: string): void {
        const roomIdTrimmed = roomId?.trim();
        if (!roomIdTrimmed) return;

        const trimmed = (message ?? '').trim().slice(0, 200);
        if (!trimmed) return;

        this.webSocketService.emitNamespace(this.namespace, WaitingRoomEvents.ChatSendMessage, {
            roomId: roomIdTrimmed,
            message: trimmed,
            characterName: playerName?.trim(),
        });
    }

    private getAllMessagesByRoom(roomId: string | undefined): BehaviorSubject<ChatMessage[]> {
        const roomKey = (roomId ?? '').trim();
        const existing = this.messagesByRoom.get(roomKey);
        if (existing) return existing;

        const subject = new BehaviorSubject<ChatMessage[]>([]);
        this.messagesByRoom.set(roomKey, subject);
        return subject;
    }
}

