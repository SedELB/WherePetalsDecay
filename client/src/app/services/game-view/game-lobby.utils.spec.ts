import {
    applyFlagPickup,
    expandSanctuaryPositions,
    getTileDebuff,
    processCombatResult,
    processCombatResultWithoutLife,
    removePlayerFromLobby,
    toggleDoor,
    updateDroppedFlagFromCombatResult,
    updateLobbyFromCombatResult,
    updatePlayerStats,
} from '@app/services/game-view/game-lobby.utils';
import { TileItem, TileTexture } from '@common/enums';
import { CombatFighterResult, CombatResult } from '@common/interfaces/game-view';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Tile } from '@common/tile';

// Constants
const FULL_LIFE = 6;
const REDUCED_LIFE = 4;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;

const SOCKET_A = 'socket-a';
const SOCKET_B = 'socket-b';

// Factories

const buildTile = (type: TileTexture, item: TileItem | null = null): Tile => ({ type, item });

const buildPlayer = (socketId: string, overrides: Partial<Player> = {}): Player => ({
    socketId,
    isHost: false,
    winsCount: 0,
    hasAbandonned: false,
    playerType: 'real' as Player['playerType'],
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
        speed: 4,
        attack: BASE_ATTACK,
        defense: BASE_DEFENSE,
        lifeBonus: false,
        attackDice: 'D6' as Player['character']['attackDice'],
        defenseDice: 'D4' as Player['character']['defenseDice'],
    },
    ...overrides,
});

const buildLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
    lobbyId: 'lobby-1',
    gameId: 'game-1',
    hostSocketId: SOCKET_A,
    playerCount: 2,
    isLocked: true,
    players: [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B)],
    game: {
        _id: 'game-1',
        name: 'Test',
        description: '',
        size: { rows: 3, cols: 3 },
        gameMode: 'classic' as Lobby['game']['gameMode'],
        thumbnail: '',
        maxPlayers: 4,
        grid: [
            [buildTile(TileTexture.Floor), buildTile(TileTexture.Floor, TileItem.Flag), buildTile(TileTexture.Floor)],
            [buildTile(TileTexture.DoorClosed), buildTile(TileTexture.Floor), buildTile(TileTexture.Floor)],
            [buildTile(TileTexture.Ice), buildTile(TileTexture.Floor), buildTile(TileTexture.Floor)],
        ],
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    pendingAvatars: {},
    chatHistory: [],
    teamA: [],
    teamB: [],
    ...overrides,
});

const buildFighterResult = (socketId: string, lifeAfter: number, killed = false): CombatFighterResult => ({
    socketId,
    attack: { base: BASE_ATTACK, postureBonus: 0, diceBonus: 1, penalty: 0, total: BASE_ATTACK + 1 },
    defense: { base: BASE_DEFENSE, postureBonus: 0, diceBonus: 0, penalty: 0, total: BASE_DEFENSE },
    damageDealt: FULL_LIFE - lifeAfter,
    lifeBefore: FULL_LIFE,
    lifeAfter,
    killed,
    oldPosition: { x: 0, y: 0 },
    newPosition: null,
});

// Tests

describe('game-lobby.utils', () => {

    // applyFlagPickup

    describe('applyFlagPickup', () => {
        // Marks the player as a flag holder and removes the flag item from the grid tile where it was picked up
        it('should mark the player as hasFlag and clear the flag tile', () => {
            const lobby = buildLobby();
            const updated = applyFlagPickup(lobby, SOCKET_A, { x: 1, y: 0 });
            const player = updated.players.find((p) => p.socketId === SOCKET_A);
            expect(player?.hasFlag).toBe(true);
            expect(updated.game.grid[0][1].item).toBeNull();
        });

        // Does not remove any tile item when no pickup position is given, e.g. during a flag transfer.
        it('should mark hasFlag without altering the grid when no position is provided', () => {
            const lobby = buildLobby();
            const updated = applyFlagPickup(lobby, SOCKET_A);
            expect(updated.players.find((p) => p.socketId === SOCKET_A)?.hasFlag).toBe(true);
            expect(updated.game.grid[0][1].item).toBe(TileItem.Flag);
        });

        // Returns the lobby unchanged when the provided socket ID does not match any known player.
        it('should not crash when socketId is not found', () => {
            const lobby = buildLobby();
            const updated = applyFlagPickup(lobby, 'ghost');
            expect(updated.players.every((p) => !p.hasFlag)).toBe(true);
        });
    });

    // toggleDoor

    describe('toggleDoor', () => {
        // Switches a closed door to open when toggled
        it('should change a DoorClosed tile to DoorOpened', () => {
            const lobby = buildLobby();
            const updated = toggleDoor(lobby, { x: 0, y: 1 });
            expect(updated.game.grid[1][0].type).toBe(TileTexture.DoorOpened);
        });

        // Switches an open door back to closed when toggled a second time
        it('should change a DoorOpened tile to DoorClosed', () => {
            const lobby = buildLobby();
            const afterOpen = toggleDoor(lobby, { x: 0, y: 1 });
            const afterClose = toggleDoor(afterOpen, { x: 0, y: 1 });
            expect(afterClose.game.grid[1][0].type).toBe(TileTexture.DoorClosed);
        });
    });

    // updatePlayerStats

    describe('updatePlayerStats', () => {
        // Merges updated stat fields into the matching player record while leaving other players unchanged
        it('should merge updated stats into the matching player', () => {
            const WINS = 3;
            const lobby = buildLobby();
            const updatedPlayer = { ...buildPlayer(SOCKET_A), winsCount: WINS };
            const result = updatePlayerStats(lobby, [updatedPlayer]);
            expect(result.players.find((p) => p.socketId === SOCKET_A)?.winsCount).toBe(WINS);
        });

        // Leaves players unchanged when no matching update is provided for their socket ID
        it('should leave unmatched players unchanged', () => {
            const lobby = buildLobby();
            const result = updatePlayerStats(lobby, []);
            expect(result.players[0].winsCount).toBe(0);
        });
    });

    // removePlayerFromLobby

    describe('removePlayerFromLobby', () => {
        /** Marks the specified player as having abandoned without removing them from the array. */
        it('should mark the player as abandoned', () => {
            const lobby = buildLobby();
            const result = removePlayerFromLobby(lobby, SOCKET_A);
            expect(result.players.find((p) => p.socketId === SOCKET_A)?.hasAbandonned).toBe(true);
        });

        /** Does not affect any other players when marking one as abandoned. */
        it('should not mark other players as abandoned', () => {
            const lobby = buildLobby();
            const result = removePlayerFromLobby(lobby, SOCKET_A);
            expect(result.players.find((p) => p.socketId === SOCKET_B)?.hasAbandonned).toBe(false);
        });
    });

    // getTileDebuff

    describe('getTileDebuff', () => {
        const lobby = buildLobby();

        /** Returns the ice debuff value of 2 for tiles typed as ice. */
        it('should return 2 for an ice tile', () => {
            expect(getTileDebuff(lobby.game.grid, { x: 0, y: 2 })).toBe(2);
        });

        /** Returns 0 debuff for standard floor tiles. */
        it('should return 0 for a non-ice tile', () => {
            expect(getTileDebuff(lobby.game.grid, { x: 1, y: 0 })).toBe(0);
        });

        /** Returns 0 when querying coordinates outside the grid bounds. */
        it('should return 0 for out-of-bounds coordinates', () => {
            expect(getTileDebuff(lobby.game.grid, { x: 99, y: 99 })).toBe(0);
        });
    });

    // updateLobbyFromCombatResult

    describe('updateLobbyFromCombatResult', () => {
        const combatResult: CombatResult = {
            attacker: buildFighterResult(SOCKET_A, REDUCED_LIFE),
            defender: buildFighterResult(SOCKET_B, 0, true),
            winnerId: SOCKET_A,
            loserId: SOCKET_B,
        };

        /** Updates both combatants' life values and removes the loser's flag when they lose. */
        it('should update life values for both players and drop the loser flag', () => {
            const lobby = buildLobby({
                players: [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B, { hasFlag: true })],
            });
            const result = updateLobbyFromCombatResult(lobby, combatResult);
            expect(result.players.find((p) => p.socketId === SOCKET_A)?.character.life).toBe(REDUCED_LIFE);
            expect(result.players.find((p) => p.socketId === SOCKET_B)?.character.life).toBe(0);
            expect(result.players.find((p) => p.socketId === SOCKET_B)?.hasFlag).toBe(false);
        });

        /** Skips life updates when shouldUpdateLife is false, as used by local combat participants who see live updates. */
        it('should not update lives when shouldUpdateLife is false', () => {
            const lobby = buildLobby();
            const result = updateLobbyFromCombatResult(lobby, combatResult, false);
            expect(result.players.find((p) => p.socketId === SOCKET_A)?.character.life).toBe(FULL_LIFE);
        });

        /** Clamps life to 0 instead of going negative when damage exceeds remaining HP. */
        it('should clamp life to 0 when lifeAfter would be negative', () => {
            const NEGATIVE_LIFE = -2;
            const negResult: CombatResult = {
                attacker: buildFighterResult(SOCKET_A, NEGATIVE_LIFE),
                defender: buildFighterResult(SOCKET_B, 0),
                winnerId: null,
                loserId: null,
            };
            const result = updateLobbyFromCombatResult(buildLobby(), negResult);
            expect(result.players.find((p) => p.socketId === SOCKET_A)?.character.life).toBe(0);
        });
    });

    // updateDroppedFlagFromCombatResult

    describe('updateDroppedFlagFromCombatResult', () => {
        // Places the Flag item onto the specified grid tile when a winner drops the loser's flag
        it('should place a flag item on the grid at the dropped position', () => {
            const result: CombatResult = {
                attacker: buildFighterResult(SOCKET_A, FULL_LIFE),
                defender: buildFighterResult(SOCKET_B, 0),
                winnerId: SOCKET_A,
                loserId: SOCKET_B,
                droppedFlagPosition: { x: 1, y: 0 },
            };
            const lobby = buildLobby();
            const updated = updateDroppedFlagFromCombatResult(lobby, result);
            expect(updated.game.grid[0][1].item).toBe(TileItem.Flag);
        });

        // Returns the lobby unchanged when there is no winner or no dropped flag position
        it('should return lobby unchanged when no winner or no drop position', () => {
            const result: CombatResult = {
                attacker: buildFighterResult(SOCKET_A, FULL_LIFE),
                defender: buildFighterResult(SOCKET_B, FULL_LIFE),
                winnerId: null,
                loserId: null,
            };
            const lobby = buildLobby();
            expect(updateDroppedFlagFromCombatResult(lobby, result)).toBe(lobby);
        });
    });

    // processCombatResult

    describe('processCombatResult', () => {
        /** Applies both life updates and flag drop in a single composed operation. */
        it('should apply life updates and flag drop together', () => {
            const result: CombatResult = {
                attacker: buildFighterResult(SOCKET_A, REDUCED_LIFE),
                defender: buildFighterResult(SOCKET_B, 0, true),
                winnerId: SOCKET_A,
                loserId: SOCKET_B,
                droppedFlagPosition: { x: 2, y: 2 },
            };
            const lobby = buildLobby({ players: [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B, { hasFlag: true })] });
            const updated = processCombatResult(lobby, result);
            expect(updated.players.find((p) => p.socketId === SOCKET_A)?.character.life).toBe(REDUCED_LIFE);
            expect(updated.game.grid[2][2].item).toBe(TileItem.Flag);
        });
    });

    // processCombatResultWithoutLife

    describe('processCombatResultWithoutLife', () => {
        /** Processes flag drop only, skipping life updates for local combat participants who track HP themselves. */
        it('should drop the flag without updating lives', () => {
            const result: CombatResult = {
                attacker: buildFighterResult(SOCKET_A, REDUCED_LIFE),
                defender: buildFighterResult(SOCKET_B, 0, true),
                winnerId: SOCKET_A,
                loserId: SOCKET_B,
                droppedFlagPosition: { x: 2, y: 2 },
            };
            const lobby = buildLobby({ players: [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B, { hasFlag: true })] });
            const updated = processCombatResultWithoutLife(lobby, result);
            expect(updated.players.find((p) => p.socketId === SOCKET_A)?.character.life).toBe(FULL_LIFE);
            expect(updated.game.grid[2][2].item).toBe(TileItem.Flag);
        });
    });

    // expandSanctuaryPositions

    describe('expandSanctuaryPositions', () => {
        const BLOCK_TILES = 4;
        const TWO_BLOCK_TILES = 8;
        const ANCHOR_X = 2;
        const ANCHOR_Y = 3;
        const FAR_X = 5;
        const FAR_Y = 5;

        /** Expands a single top-left coordinate into the four-tile 2×2 sanctuary block. */
        it('should produce 4 tiles per top-left coordinate', () => {
            expect(expandSanctuaryPositions([{ x: 0, y: 0 }]).length).toBe(BLOCK_TILES);
        });

        /** Correctly offsets the block tiles from the top-left anchor. */
        it('should produce correct offsets', () => {
            const result = expandSanctuaryPositions([{ x: ANCHOR_X, y: ANCHOR_Y }]);
            expect(result).toContain(jasmine.objectContaining({ x: ANCHOR_X, y: ANCHOR_Y }));
            expect(result).toContain(jasmine.objectContaining({ x: ANCHOR_X + 1, y: ANCHOR_Y }));
            expect(result).toContain(jasmine.objectContaining({ x: ANCHOR_X, y: ANCHOR_Y + 1 }));
            expect(result).toContain(jasmine.objectContaining({ x: ANCHOR_X + 1, y: ANCHOR_Y + 1 }));
        });

        /** Produces 8 tiles when two separate sanctuaries are expanded at once. */
        it('should expand multiple sanctuaries independently', () => {
            expect(expandSanctuaryPositions([{ x: 0, y: 0 }, { x: FAR_X, y: FAR_Y }]).length).toBe(TWO_BLOCK_TILES);
        });

        /** Returns an empty array when no top-left positions are provided. */
        it('should return empty for no input', () => {
            expect(expandSanctuaryPositions([])).toEqual([]);
        });
    });
});
