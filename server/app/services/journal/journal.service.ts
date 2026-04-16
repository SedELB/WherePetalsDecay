import { JournalEntry, JournalEventType } from '@common/journal-entry';
import { Injectable } from '@nestjs/common';

export type JournalEntryCallback = (lobbyId: string, entry: JournalEntry) => void;

export interface JournalEntryOptions {
    eventType: JournalEventType;
    playerNames: string[];
    message: string;
    isPrivate?: boolean;
    involvedPlayerIds?: string[];
}

@Injectable()
export class JournalService {
    private readonly entries: Map<string, JournalEntry[]> = new Map();
    private onEntryAdded: JournalEntryCallback | null = null;

    setOnEntryAdded(callback: JournalEntryCallback): void {
        this.onEntryAdded = callback;
    }

    addEntry(lobbyId: string, options: JournalEntryOptions): void {
        const entry: JournalEntry = {
            timestamp: new Date(),
            eventType: options.eventType,
            playerNames: options.playerNames,
            message: options.message,
            isPrivate: options.isPrivate ?? false,
            involvedPlayerIds: options.involvedPlayerIds ?? [],
        };

        if (!this.entries.has(lobbyId)) {
            this.entries.set(lobbyId, []);
        }
        this.entries.get(lobbyId).push(entry);

        if (this.onEntryAdded) {
            this.onEntryAdded(lobbyId, entry);
        }
    }

    addTurnStartEntry(lobbyId: string, playerName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.TurnStart,
            playerNames: [playerName],
            message: `Début du tour de ${playerName}.`,
        });
    }

    addFlagPickedUpEntry(lobbyId: string, playerName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.FlagPickedUp,
            playerNames: [playerName],
            message: `${playerName} a ramassé le drapeau.`,
        });
    }

    addDebugToggleEntry(lobbyId: string, hostName: string, state: boolean): void {
        const modeLabel = state ? 'activé' : 'désactivé';
        this.addEntry(lobbyId, {
            eventType: JournalEventType.DebugToggle,
            playerNames: [hostName],
            message: `Mode de débogage ${modeLabel} par ${hostName}.`,
        });
    }

    addCombatStartEntry(lobbyId: string, attackerName: string, defenderName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatStart,
            playerNames: [attackerName, defenderName],
            message: `Début du combat : ${attackerName} vs ${defenderName}.`,
        });
    }

    addCombatDamageEntry(lobbyId: string, winnerName: string, loserName: string, attackerId: string, defenderId: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatDamageResult,
            playerNames: [winnerName, loserName],
            message: `${winnerName} inflige des dégâts à ${loserName}.`,
            isPrivate: true,
            involvedPlayerIds: [attackerId, defenderId],
        });
    }

    addCombatEndEntry(lobbyId: string, winnerName: string, loserName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatEnd,
            playerNames: [winnerName, loserName],
            message: `Fin du combat : ${winnerName} remporte le combat contre ${loserName}.`,
        });
    }

    addFlagTransferEntry(lobbyId: string, giverName: string, receiverName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.FlagTransfer,
            playerNames: [giverName, receiverName],
            message: `${giverName} transfère son drapeau à ${receiverName}.`,
        });
    }

    addPlayerAbandonEntry(lobbyId: string, playerName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.PlayerAbandon,
            playerNames: [playerName],
            message: `${playerName} a abandonné la partie.`,
        });
    }

    addGameOverEntry(lobbyId: string, activeNames: string[]): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.GameOver,
            playerNames: activeNames,
            message: `Fin de la partie. Joueurs encore actifs : ${activeNames.join(', ')}.`,
        });
    }

    addDoorOpenEntry(lobbyId: string, playerName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.DoorOpen,
            playerNames: [playerName],
            message: `${playerName} a ouvert une porte.`,
        });
    }

    addDoorCloseEntry(lobbyId: string, playerName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.DoorClose,
            playerNames: [playerName],
            message: `${playerName} a fermé une porte.`,
        });
    }

    addSanctuaryUsedEntry(lobbyId: string, playerName: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.SanctuaryUsed,
            playerNames: [playerName],
            message: `${playerName} a utilisé un sanctuaire.`,
        });
    }

    addSanctuaryUsedWithModeEntry(lobbyId: string, playerName: string, sanctuaryLabel: string, modeLabel: string): void {
        this.addEntry(lobbyId, {
            eventType: JournalEventType.SanctuaryUsed,
            playerNames: [playerName],
            message: `${playerName} a utilisé un sanctuaire de ${sanctuaryLabel}${modeLabel}.`,
        });
    }

    getEntries(lobbyId: string): JournalEntry[] {
        return this.entries.get(lobbyId) ?? [];
    }

    clearEntries(lobbyId: string): void {
        this.entries.delete(lobbyId);
    }
}
