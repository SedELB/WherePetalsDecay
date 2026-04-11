import { Injectable } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { JournalEntry } from '@common/journal-entry';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class JournalService {
    private readonly namespace = SocketNamespace.Join;
    private readonly entriesSubject = new BehaviorSubject<JournalEntry[]>([]);
    readonly entries$: Observable<JournalEntry[]> = this.entriesSubject.asObservable();

    constructor(private readonly webSocketService: WebSocketService) {
        this.webSocketService.onNamespace<JournalEntry>(this.namespace, JoinGameEvents.JournalEntry, (entry) => {
            this.entriesSubject.next([...this.entriesSubject.getValue(), entry]);
        });

        this.webSocketService.onNamespace<JournalEntry[]>(this.namespace, JoinGameEvents.JournalHistorySent, (entries) => {
            this.entriesSubject.next(entries);
        });
    }

    requestHistory(lobbyId: string): void {
        if (!lobbyId) return;
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.JournalHistoryRequest, lobbyId);
    }

    getEntries$(lobbyId: string): Observable<JournalEntry[]> {
        this.requestHistory(lobbyId);
        return this.entries$;
    }

    reset(): void {
        this.entriesSubject.next([]);
    }
}
