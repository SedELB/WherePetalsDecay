import {
    CombatRoundJournalEntryDetails,
    JournalEntryCallback,
    JournalEntryOptions,
    SanctuaryJournalDetails,
} from '@app/interfaces/journal.interface';
import { SanctuaryMode, TileItem } from '@common/enums';
import { CombatStatBreakdown } from '@common/interfaces/game-view';
import { JournalEntry, JournalEventType } from '@common/journal-entry';
import { Injectable } from '@nestjs/common';

export { CombatRoundJournalEntryDetails, JournalEntryCallback, JournalEntryOptions, SanctuaryJournalDetails };

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
            playerNames: options.playerNames.map((name) => name.trim()).filter((name) => name.length > 0),
            message: this.normalizeMessage(options.message),
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

    addCombatRoundEntries(lobbyId: string, details: CombatRoundJournalEntryDetails): void {
        const involvedPlayerIds = [details.attackerId, details.defenderId];

        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatAttackDetail,
            playerNames: [details.attackerName],
            message: this.buildCombatStatMessage('Attaque', details.attackerName, details.attackerAttack),
            isPrivate: true,
            involvedPlayerIds,
        });

        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatDefenseDetail,
            playerNames: [details.attackerName],
            message: this.buildCombatStatMessage('Défense', details.attackerName, details.attackerDefense),
            isPrivate: true,
            involvedPlayerIds,
        });

        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatAttackDetail,
            playerNames: [details.defenderName],
            message: this.buildCombatStatMessage('Attaque', details.defenderName, details.defenderAttack),
            isPrivate: true,
            involvedPlayerIds,
        });

        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatDefenseDetail,
            playerNames: [details.defenderName],
            message: this.buildCombatStatMessage('Défense', details.defenderName, details.defenderDefense),
            isPrivate: true,
            involvedPlayerIds,
        });

        this.addEntry(lobbyId, {
            eventType: JournalEventType.CombatDamageResult,
            playerNames: [details.attackerName, details.defenderName],
            message: this.buildCombatRoundDamageMessage(details),
            isPrivate: true,
            involvedPlayerIds,
        });

        if (details.damageToDefender > 0) {
            this.addCombatDamageEntry(lobbyId, details.attackerName, details.defenderName, details.attackerId, details.defenderId);
        }
        if (details.damageToAttacker > 0) {
            this.addCombatDamageEntry(lobbyId, details.defenderName, details.attackerName, details.attackerId, details.defenderId);
        }
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

    addSanctuaryUsedEntry(lobbyId: string, playerName: string, details: SanctuaryJournalDetails = {}): void {
        const {
            sanctuaryType,
            mode = SanctuaryMode.Normal,
            healAmount = 0,
            combatBonusApplied = false,
        } = details;

        this.addEntry(lobbyId, {
            eventType: JournalEventType.SanctuaryUsed,
            playerNames: [playerName],
            message: this.buildSanctuaryMessage(playerName, sanctuaryType, mode, healAmount, combatBonusApplied),
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

    private buildSanctuaryMessage(
        playerName: string,
        sanctuaryType?: TileItem,
        mode: SanctuaryMode = SanctuaryMode.Normal,
        healAmount = 0,
        combatBonusApplied = false,
    ): string {
        const sanctuaryLabel = sanctuaryType === TileItem.HealingSanctuary
            ? ' de soin'
            : sanctuaryType === TileItem.CombatSanctuary
                ? ' de combat'
                : '';
        const modeLabel = mode === SanctuaryMode.DoubleOrNothing ? ' (double ou rien)' : '';
        const base = `${playerName} a utilisé un sanctuaire${sanctuaryLabel}${modeLabel}`;

        if (sanctuaryType === TileItem.HealingSanctuary) {
            if (healAmount > 0) return `${base} et a récupéré ${healAmount} PV`;
            return `${base}, sans récupération de PV`;
        }

        if (sanctuaryType === TileItem.CombatSanctuary) {
            if (combatBonusApplied) return `${base} et a obtenu un bonus de combat`;
            return `${base}, sans bonus de combat`;
        }

        return base;
    }

    private buildCombatStatMessage(statType: 'Attaque' | 'Défense', playerName: string, stat: CombatStatBreakdown): string {
        return `${statType} de ${playerName} : base ${stat.base}, posture ${this.formatSignedValue(stat.postureBonus)}, ` +
            `dé ${this.formatSignedValue(stat.diceBonus)}, malus ${this.formatPenaltyValue(stat.penalty)}, total ${stat.total}`;
    }

    private buildCombatRoundDamageMessage(details: CombatRoundJournalEntryDetails): string {
        return `${details.attackerName} inflige ${this.formatDamageValue(details.damageToDefender)} à ${details.defenderName} ` +
            `(attaque ${details.attackerAttack.total} vs défense ${details.defenderDefense.total}); ` +
            `${details.defenderName} inflige ${this.formatDamageValue(details.damageToAttacker)} à ${details.attackerName} ` +
            `(attaque ${details.defenderAttack.total} vs défense ${details.attackerDefense.total})`;
    }

    private formatSignedValue(value: number): string {
        if (value > 0) return `+${value}`;
        return `${value}`;
    }

    private formatPenaltyValue(penalty: number): string {
        if (penalty > 0) return `-${penalty}`;
        if (penalty < 0) return `+${Math.abs(penalty)}`;
        return '0';
    }

    private formatDamageValue(damage: number): string {
        return `${damage} ${damage === 1 ? 'dégât' : 'dégâts'}`;
    }

    private normalizeMessage(message: string): string {
        const normalized = message.replace(/\s+/g, ' ').trim();
        if (normalized.length === 0) return '';
        return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`;
    }
}
