import { SanctuaryMode, TileItem } from '@common/enums';
import { CombatStatBreakdown } from '@common/interfaces/game-view';
import { JournalEntry, JournalEventType } from '@common/journal-entry';

export type JournalEntryCallback = (lobbyId: string, entry: JournalEntry) => void;

export interface JournalEntryOptions {
    eventType: JournalEventType;
    playerNames: string[];
    message: string;
    isPrivate?: boolean;
    involvedPlayerIds?: string[];
}

export interface SanctuaryJournalDetails {
    sanctuaryType?: TileItem;
    mode?: SanctuaryMode;
    healAmount?: number;
    combatBonusApplied?: boolean;
}

export interface CombatRoundJournalEntryDetails {
    attackerId: string;
    attackerName: string;
    attackerAttack: CombatStatBreakdown;
    attackerDefense: CombatStatBreakdown;
    defenderId: string;
    defenderName: string;
    defenderAttack: CombatStatBreakdown;
    defenderDefense: CombatStatBreakdown;
    damageToDefender: number;
    damageToAttacker: number;
}
