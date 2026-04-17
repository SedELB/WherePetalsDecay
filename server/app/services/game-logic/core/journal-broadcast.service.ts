import { JournalService } from '@app/services/journal/journal.service';
import { JournalEntry } from '@common/journal-entry';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class JournalBroadcastService {
    @Inject() private readonly journalService: JournalService;

    initialize(server: Server): void {
        this.journalService.setOnEntryAdded((lobbyId: string, entry: JournalEntry) => {
            if (entry.isPrivate && entry.involvedPlayerIds.length > 0) {
                this.emitToInvolvedPlayers(server, lobbyId, entry);
            } else {
                server.to(lobbyId).emit(JoinGameEvents.JournalEntry, entry);
            }
        });
    }

    handleHistoryRequest(socket: Socket, lobbyId: string): void {
        const allEntries = this.journalService.getEntries(lobbyId);
        const visibleEntries = allEntries.filter(
            (entry) => !entry.isPrivate || entry.involvedPlayerIds.includes(socket.id),
        );
        socket.emit(JoinGameEvents.JournalHistorySent, visibleEntries);
    }

    private emitToInvolvedPlayers(server: Server, lobbyId: string, entry: JournalEntry): void {
        server.in(lobbyId).fetchSockets().then((connectedSockets) => {
            for (const connectedSocket of connectedSockets) {
                if (entry.involvedPlayerIds.includes(connectedSocket.id)) {
                    connectedSocket.emit(JoinGameEvents.JournalEntry, entry);
                }
            }
        });
    }
}
