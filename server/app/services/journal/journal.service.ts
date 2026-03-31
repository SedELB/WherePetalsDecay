import { JournalEntry, JournalEventType } from '@common/journal-entry';
import { Injectable } from '@nestjs/common';

export type JournalEntryCallback = (lobbyId: string, entry: JournalEntry) => void;

@Injectable()
export class JournalService {
    private readonly entries: Map<string, JournalEntry[]> = new Map();
    private onEntryAdded: JournalEntryCallback | null = null;

    setOnEntryAdded(callback: JournalEntryCallback): void {
        this.onEntryAdded = callback;
    }

    addEntry(lobbyId: string, eventType: JournalEventType, playerNames: string[], message: string, isPrivate = false, involvedPlayerIds: string[] = []): void {
        const entry: JournalEntry = {
            timestamp: new Date(),
            eventType,
            playerNames,
            message,
            isPrivate,
            involvedPlayerIds,
        };

        if (!this.entries.has(lobbyId)) {
            this.entries.set(lobbyId, []);
        }
        this.entries.get(lobbyId).push(entry);

        if (this.onEntryAdded) {
            this.onEntryAdded(lobbyId, entry);
        }
    }

    getEntries(lobbyId: string): JournalEntry[] {
        return this.entries.get(lobbyId) ?? [];
    }

    clearEntries(lobbyId: string): void {
        this.entries.delete(lobbyId);
    }
}
