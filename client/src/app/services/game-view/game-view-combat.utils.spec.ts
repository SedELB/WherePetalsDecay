import {
    buildAbandonMessage,
    buildCombatEndedMessage,
    buildCombatEndedMessageContext,
    buildCombatStartData,
    buildDeathMessage,
    getCombatantName,
    getLoserSocketId,
    resolveCombatStartIceDebuff,
} from '@app/services/game-view/game-view-combat.utils';
import { DEFAULT_COMBAT_POSTURE } from '@app/services/game-view/game-view.constants';
import { DiceType, PlayerType, TileTexture } from '@common/enums';
import { CombatEndedData, CombatStartedData } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { Tile } from '@common/tile';

// Constants
const FULL_LIFE = 6;
const BASE_SPEED = 4;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;

const ATTACKER_ID = 'attacker';
const DEFENDER_ID = 'defender';
const WINNER_ID = ATTACKER_ID;
const ROOM_ID = 'room-1';

// Factories

const buildPlayer = (socketId: string): Player => ({
    socketId,
    isHost: false,
    winsCount: 0,
    hasAbandonned: false,
    playerType: PlayerType.Reel,
    hasFlag: false,
    combatCount: 0,
    lossCount: 0,
    totalHpLost: 0,
    totalHpDealt: 0,
    visitedTilesCount: 0,
    character: {
        name: `Player-${socketId}`,
        avatar: '',
        life: FULL_LIFE,
        speed: BASE_SPEED,
        attack: BASE_ATTACK,
        defense: BASE_DEFENSE,
        lifeBonus: false,
        attackDice: DiceType.D6,
        defenseDice: DiceType.D4,
    },
});

const buildCombatEndedData = (overrides: Partial<CombatEndedData> = {}): CombatEndedData => ({
    roomId: ROOM_ID,
    attackerSocketId: ATTACKER_ID,
    defenderSocketId: DEFENDER_ID,
    attackerKilled: false,
    defenderKilled: true,
    winnerId: WINNER_ID,
    reason: 'death',
    ...overrides,
});

const buildIceGrid = (): Tile[][] => [
    [{ type: TileTexture.Ice, item: null }],
];

const buildFloorGrid = (): Tile[][] => [
    [{ type: TileTexture.Floor, item: null }],
];

describe('game-view-combat.utils', () => {

    describe('getCombatantName', () => {
        const players = [buildPlayer(ATTACKER_ID), buildPlayer(DEFENDER_ID)];

        /** Returns the character name for a socket ID that matches a known player in the roster. */
        it('should return the character name for a known socket', () => {
            expect(getCombatantName(players, ATTACKER_ID, 'Fallback')).toBe(`Player-${ATTACKER_ID}`);
        });

        /** Returns the fallback string when the socket ID is null to prevent empty UI labels. */
        it('should return the fallback when socketId is null', () => {
            expect(getCombatantName(players, null, 'Fallback')).toBe('Fallback');
        });

        /** Returns the fallback string when no player in the list matches the given socket ID. */
        it('should return the fallback for an unknown socket', () => {
            expect(getCombatantName(players, 'ghost', 'Fallback')).toBe('Fallback');
        });
    });

    describe('getLoserSocketId', () => {
        /** Returns the defender socket ID when the attacker won the combat. */
        it('should return the defender socket when the attacker wins', () => {
            const data = buildCombatEndedData({ winnerId: ATTACKER_ID });
            expect(getLoserSocketId(data)).toBe(DEFENDER_ID);
        });

        /** Returns the attacker socket ID when the defender won the combat. */
        it('should return the attacker socket when the defender wins', () => {
            const data = buildCombatEndedData({ winnerId: DEFENDER_ID });
            expect(getLoserSocketId(data)).toBe(ATTACKER_ID);
        });

        /** Returns null when there is no winner, such as in a double KO scenario. */
        it('should return null when there is no winner', () => {
            const data = buildCombatEndedData({ winnerId: null });
            expect(getLoserSocketId(data)).toBeNull();
        });
    });

    describe('buildCombatEndedMessageContext', () => {
        const players = [buildPlayer(ATTACKER_ID), buildPlayer(DEFENDER_ID)];

        /** Shows "Vous" as the winner display name when the local player is the winner. */
        it('should set winnerIsLocal and display "Vous" when local player wins', () => {
            const ctx = buildCombatEndedMessageContext(buildCombatEndedData(), players, ATTACKER_ID);
            expect(ctx.winnerIsLocal).toBe(true);
            expect(ctx.winnerDisplayName).toBe('Vous');
        });

        /** Shows "Vous" as the loser display name when the local player is the loser. */
        it('should set loserIsLocal and display "Vous" when local player loses', () => {
            const ctx = buildCombatEndedMessageContext(buildCombatEndedData(), players, DEFENDER_ID);
            expect(ctx.loserIsLocal).toBe(true);
            expect(ctx.loserDisplayName).toBe('Vous');
        });

        /** Uses character names when neither combatant is the local player. */
        it('should use character names when neither is local', () => {
            const ctx = buildCombatEndedMessageContext(buildCombatEndedData(), players, 'spectator');
            expect(ctx.winnerIsLocal).toBe(false);
            expect(ctx.winnerDisplayName).toBe(`Player-${ATTACKER_ID}`);
        });
    });

    describe('buildAbandonMessage', () => {
        /** Generates the French abandon message in first person when the local player abandons. */
        it('should generate a first-person abandon message for the loser', () => {
            const ctx = { winnerIsLocal: false, loserIsLocal: true, winnerDisplayName: `Player-${ATTACKER_ID}`, loserDisplayName: 'Vous' };
            expect(buildAbandonMessage(ctx)).toContain('Vous avez abandonné.');
        });

        /** Generates a third-person abandon message when an opponent abandons. */
        it('should generate a third-person abandon message for an opponent', () => {
            const ctx = { winnerIsLocal: true, loserIsLocal: false, winnerDisplayName: 'Vous', loserDisplayName: `Player-${DEFENDER_ID}` };
            expect(buildAbandonMessage(ctx)).toContain('abandonné.');
        });
    });

    describe('buildDeathMessage', () => {
        /** Generates the French death message in first person when the local player dies. */
        it('should generate a first-person death message', () => {
            const ctx = { winnerIsLocal: false, loserIsLocal: true, winnerDisplayName: `Player-${ATTACKER_ID}`, loserDisplayName: 'Vous' };
            expect(buildDeathMessage(ctx)).toContain('Vous êtes mort.');
        });

        /** Generates a third-person death message when an opponent is eliminated. */
        it('should generate a third-person death message for an opponent', () => {
            const ctx = { winnerIsLocal: true, loserIsLocal: false, winnerDisplayName: 'Vous', loserDisplayName: `Player-${DEFENDER_ID}` };
            expect(buildDeathMessage(ctx)).toContain('est mort.');
        });
    });

    describe('buildCombatEndedMessage', () => {
        const players = [buildPlayer(ATTACKER_ID), buildPlayer(DEFENDER_ID)];

        /** Returns the double KO message when both combatants were simultaneously eliminated. */
        it('should return double KO message when both are killed', () => {
            const data = buildCombatEndedData({ attackerKilled: true, defenderKilled: true, winnerId: null });
            expect(buildCombatEndedMessage(data, players, ATTACKER_ID)).toBe('Double K.O. Aucun gagnant du combat.');
        });

        /** Returns an abandon-specific message when the combat ended due to player abandonment. */
        it('should return abandon message for reason "abandon"', () => {
            const data = buildCombatEndedData({ reason: 'abandon' });
            expect(buildCombatEndedMessage(data, players, ATTACKER_ID)).toContain('abandonné');
        });

        /** Returns a death-outcome message when a player was killed normally. */
        it('should return death message for reason "death" with a winner', () => {
            const data = buildCombatEndedData({ reason: 'death', winnerId: ATTACKER_ID });
            expect(buildCombatEndedMessage(data, players, ATTACKER_ID)).toContain('mort');
        });

        /** Returns a generic fallback message when there is no winner and no kill. */
        it('should return generic fallback when no winner and not double KO', () => {
            const data = buildCombatEndedData({ winnerId: null, attackerKilled: false, defenderKilled: false });
            expect(buildCombatEndedMessage(data, players, ATTACKER_ID)).toBe('Combat terminé.');
        });
    });

    describe('resolveCombatStartIceDebuff', () => {
        /** Returns the ice debuff value of 2 when the player stands on an ice tile at combat start. */
        it('should return 2 for a player on an ice tile', () => {
            const positions = { [ATTACKER_ID]: { x: 0, y: 0 } };
            expect(resolveCombatStartIceDebuff(ATTACKER_ID, undefined, positions, buildIceGrid())).toBe(2);
        });

        /** Returns 0 for a player on a non-ice tile. */
        it('should return 0 for a player on a floor tile', () => {
            const positions = { [ATTACKER_ID]: { x: 0, y: 0 } };
            expect(resolveCombatStartIceDebuff(ATTACKER_ID, undefined, positions, buildFloorGrid())).toBe(0);
        });

        /** Returns the provided fallback debuff when the player has no position recorded. */
        it('should return the fallback debuf when position is missing', () => {
            expect(resolveCombatStartIceDebuff(ATTACKER_ID, 2, {}, buildFloorGrid())).toBe(2);
        });

        /** Returns 0 when no position and no fallback are provided. */
        it('should return 0 when no position and no fallback', () => {
            expect(resolveCombatStartIceDebuff(ATTACKER_ID, undefined, {}, buildFloorGrid())).toBe(0);
        });

        /** Returns the fallback debuf when the game grid is undefined. */
        it('should return the fallback when grid is undefined', () => {
            const positions = { [ATTACKER_ID]: { x: 0, y: 0 } };
            expect(resolveCombatStartIceDebuff(ATTACKER_ID, 2, positions, undefined)).toBe(2);
        });
    });

    describe('buildCombatStartData', () => {
        const attacker = buildPlayer(ATTACKER_ID);
        const defender = buildPlayer(DEFENDER_ID);
        const startData: CombatStartedData = { player: attacker, enemy: defender, roomId: ROOM_ID };

        /** Assigns the default neutral posture to both player and enemy at combat start. */
        it('should assign default combat posture to both combatants', () => {
            const positions = { [ATTACKER_ID]: { x: 0, y: 0 }, [DEFENDER_ID]: { x: 0, y: 1 } };
            const result = buildCombatStartData(startData, positions, buildFloorGrid());
            expect(result.player.character.bonusPosture).toEqual(DEFAULT_COMBAT_POSTURE);
            expect(result.enemy.character.bonusPosture).toEqual(DEFAULT_COMBAT_POSTURE);
        });

        /** Sets the ice debuff on the player when the attacker starts combat on an ice tile. */
        it('should set ice debuf on the attacker when on ice', () => {
            const positions = { [ATTACKER_ID]: { x: 0, y: 0 }, [DEFENDER_ID]: { x: 0, y: 1 } };
            const grid: Tile[][] = [
                [{ type: TileTexture.Ice, item: null }],
                [{ type: TileTexture.Floor, item: null }],
            ];
            const result = buildCombatStartData(startData, positions, grid);
            expect(result.player.character.debuf).toBe(2);
        });

        /** Sets the ice debuff on the enemy when the defender starts combat on an ice tile. */
        it('should set ice debuf on the enemy when defender is on ice', () => {
            const positions = { [ATTACKER_ID]: { x: 0, y: 0 }, [DEFENDER_ID]: { x: 0, y: 1 } };
            const grid: Tile[][] = [
                [{ type: TileTexture.Floor, item: null }],
                [{ type: TileTexture.Ice, item: null }],
            ];
            const result = buildCombatStartData(startData, positions, grid);
            expect(result.enemy.character.debuf).toBe(2);
        });

        /** Preserves the room ID from the original start data payload. */
        it('should preserve the original roomId', () => {
            const result = buildCombatStartData(startData, {}, undefined);
            expect(result.roomId).toBe(ROOM_ID);
        });
    });
});
