import { SanctuaryMode, TileItem } from '@common/enums';
import { JournalEventType } from '@common/journal-entry';
import { JournalService } from './journal.service';

const HEAL_AMOUNT = 4;
const ATTACKER_ATTACK_BASE = 5;
const ATTACKER_ATTACK_POSTURE = 2;
const ATTACKER_ATTACK_DICE = 3;
const ATTACKER_ATTACK_PENALTY = 1;
const ATTACKER_ATTACK_TOTAL = 9;
const ATTACKER_DEFENSE_BASE = 6;
const ATTACKER_DEFENSE_POSTURE = 2;
const ATTACKER_DEFENSE_DICE = 0;
const ATTACKER_DEFENSE_PENALTY = 0;
const ATTACKER_DEFENSE_TOTAL = 8;
const DEFENDER_ATTACK_BASE = 4;
const DEFENDER_ATTACK_POSTURE = 2;
const DEFENDER_ATTACK_DICE = 2;
const DEFENDER_ATTACK_PENALTY = 0;
const DEFENDER_ATTACK_TOTAL = 8;
const DEFENDER_DEFENSE_BASE = 5;
const DEFENDER_DEFENSE_POSTURE = 2;
const DEFENDER_DEFENSE_DICE = 1;
const DEFENDER_DEFENSE_PENALTY = 1;
const DEFENDER_DEFENSE_TOTAL = 7;
const DAMAGE_TO_DEFENDER = 2;
const DAMAGE_TO_ATTACKER = 1;
const EXPECTED_COMBAT_ENTRY_COUNT = 7;

describe('JournalService', () => {
    let service: JournalService;

    beforeEach(() => {
        service = new JournalService();
    });

    it('normalizes whitespace and punctuation for journal entries', () => {
        service.addEntry('lobby-1', {
            eventType: JournalEventType.TurnStart,
            playerNames: ['  Alice  '],
            message: '  Début   du   tour de Alice  ',
        });

        const [entry] = service.getEntries('lobby-1');
        expect(entry.playerNames).toEqual(['Alice']);
        expect(entry.message).toBe('Début du tour de Alice.');
    });

    it('formats healing sanctuary journal messages with effect details', () => {
        service.addSanctuaryUsedEntry(
            'lobby-1',
            'Bob',
            {
                sanctuaryType: TileItem.HealingSanctuary,
                mode: SanctuaryMode.DoubleOrNothing,
                healAmount: HEAL_AMOUNT,
                combatBonusApplied: false,
            },
        );

        const [entry] = service.getEntries('lobby-1');
        expect(entry.eventType).toBe(JournalEventType.SanctuaryUsed);
        expect(entry.message).toContain('Bob a utilisé un sanctuaire de soin (double ou rien)');
        expect(entry.message).toContain(`et a récupéré ${HEAL_AMOUNT} PV`);
        expect(entry.message.endsWith('.')).toBe(true);
    });

    it('formats combat sanctuary journal messages when bonus is not applied', () => {
        service.addSanctuaryUsedEntry(
            'lobby-1',
            'Bot Défensif',
            {
                sanctuaryType: TileItem.CombatSanctuary,
                mode: SanctuaryMode.Normal,
                healAmount: 0,
                combatBonusApplied: false,
            },
        );

        const [entry] = service.getEntries('lobby-1');
        expect(entry.eventType).toBe(JournalEventType.SanctuaryUsed);
        expect(entry.message).toBe('Bot Défensif a utilisé un sanctuaire de combat, sans bonus de combat.');
    });

    it('formats combat round journal entries with consistent and readable text', () => {
        service.addCombatRoundEntries('lobby-1', {
            attackerId: 'attacker-id',
            attackerName: 'Alice',
            attackerAttack: {
                base: ATTACKER_ATTACK_BASE,
                postureBonus: ATTACKER_ATTACK_POSTURE,
                diceBonus: ATTACKER_ATTACK_DICE,
                penalty: ATTACKER_ATTACK_PENALTY,
                total: ATTACKER_ATTACK_TOTAL,
            },
            attackerDefense: {
                base: ATTACKER_DEFENSE_BASE,
                postureBonus: ATTACKER_DEFENSE_POSTURE,
                diceBonus: ATTACKER_DEFENSE_DICE,
                penalty: ATTACKER_DEFENSE_PENALTY,
                total: ATTACKER_DEFENSE_TOTAL,
            },
            defenderId: 'defender-id',
            defenderName: 'Bob',
            defenderAttack: {
                base: DEFENDER_ATTACK_BASE,
                postureBonus: DEFENDER_ATTACK_POSTURE,
                diceBonus: DEFENDER_ATTACK_DICE,
                penalty: DEFENDER_ATTACK_PENALTY,
                total: DEFENDER_ATTACK_TOTAL,
            },
            defenderDefense: {
                base: DEFENDER_DEFENSE_BASE,
                postureBonus: DEFENDER_DEFENSE_POSTURE,
                diceBonus: DEFENDER_DEFENSE_DICE,
                penalty: DEFENDER_DEFENSE_PENALTY,
                total: DEFENDER_DEFENSE_TOTAL,
            },
            damageToDefender: DAMAGE_TO_DEFENDER,
            damageToAttacker: DAMAGE_TO_ATTACKER,
        });

        const entries = service.getEntries('lobby-1');
        expect(entries).toHaveLength(EXPECTED_COMBAT_ENTRY_COUNT);

        expect(entries[0].eventType).toBe(JournalEventType.CombatAttackDetail);
        expect(entries[0].message).toBe('Attaque de Alice : base 5, posture +2, dé +3, malus -1, total 9.');

        expect(entries[1].eventType).toBe(JournalEventType.CombatDefenseDetail);
        expect(entries[1].message).toBe('Défense de Alice : base 6, posture +2, dé 0, malus 0, total 8.');

        expect(entries[2].eventType).toBe(JournalEventType.CombatAttackDetail);
        expect(entries[2].message).toBe('Attaque de Bob : base 4, posture +2, dé +2, malus 0, total 8.');

        expect(entries[3].eventType).toBe(JournalEventType.CombatDefenseDetail);
        expect(entries[3].message).toBe('Défense de Bob : base 5, posture +2, dé +1, malus -1, total 7.');

        expect(entries[4].eventType).toBe(JournalEventType.CombatDamageResult);
        expect(entries[4].message).toBe(
            'Alice inflige 2 dégâts à Bob (attaque 9 vs défense 7); Bob inflige 1 dégât à Alice (attaque 8 vs défense 8).',
        );

        expect(entries[5].eventType).toBe(JournalEventType.CombatDamageResult);
        expect(entries[5].message).toBe('Alice inflige des dégâts à Bob.');

        expect(entries[6].eventType).toBe(JournalEventType.CombatDamageResult);
        expect(entries[6].message).toBe('Bob inflige des dégâts à Alice.');
    });
});
