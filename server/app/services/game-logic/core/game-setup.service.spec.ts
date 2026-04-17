/**
 * Test suite for GameSetupService (server-side).
 * This service provides deterministic setup utilities for initialising a game session:
 * spawn extraction, unused-spawn pruning, turn-order computation, sanctuary/door extraction.
 * The tests use minimal Game fixtures to avoid any database or socket dependencies.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { GameSetupService } from './game-setup.service';
import { GameStatsService } from './game-stats.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Game } from '@common/game';
import { Player } from '@common/player';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_LIFE = 6;
const DEFAULT_SPEED = 4;
const FAST_SPEED = 8;
const GRID_SIZE = 3;
const PLAYER_COUNT = 3;
const SINGLE_ELEMENT = 42;

const SOCKET_A = 'socket-a';
const SOCKET_B = 'socket-b';
const SOCKET_C = 'socket-c';

// ─── Factories ────────────────────────────────────────────────────────────────

const buildPlayer = (socketId: string, speed = DEFAULT_SPEED): Player => ({
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
        life: DEFAULT_LIFE,
        speed,
        attack: 4,
        defense: 4,
        lifeBonus: false,
        attackDice: 'D6' as Player['character']['attackDice'],
        defenseDice: 'D4' as Player['character']['defenseDice'],
    },
});

const buildGame = (grid: Game['grid']): Game => ({
    _id: 'game-1',
    name: 'Test',
    description: '',
    size: { rows: GRID_SIZE, cols: GRID_SIZE },
    gameMode: GameMode.Classic,
    thumbnail: '',
    maxPlayers: 4,
    grid,
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
});

const buildGridWith = (positions: { row: number; col: number; item?: TileItem; type?: TileTexture }[]): Game['grid'] => {
    const grid: Game['grid'] = Array.from({ length: GRID_SIZE }, () =>
        Array.from({ length: GRID_SIZE }, () => ({ type: TileTexture.Floor, item: null })),
    );
    for (const pos of positions) {
        grid[pos.row][pos.col] = {
            type: pos.type ?? TileTexture.Floor,
            item: pos.item ?? null,
        };
    }
    return grid;
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('GameSetupService', () => {
    let service: GameSetupService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameSetupService,
                GameStatsService,
            ],
        }).compile();

        service = module.get<GameSetupService>(GameSetupService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ─── extractSpawnPositions ────────────────────────────────────────────────

    describe('extractSpawnPositions', () => {
        /** Collects the coordinates of every Spawn tile scattered across the game grid. */
        it('should return all spawn tile coordinates', () => {
            const game = buildGame(buildGridWith([
                { row: 0, col: 0, item: TileItem.Spawn },
                { row: 2, col: 1, item: TileItem.Spawn },
            ]));
            const result = service.extractSpawnPositions(game);
            expect(result.length).toBe(2);
            expect(result).toContainEqual(expect.objectContaining({ x: 0, y: 0 }));
            expect(result).toContainEqual(expect.objectContaining({ x: 1, y: 2 }));
        });

        /** Returns an empty array when the grid contains no spawn tiles. */
        it('should return empty array when no spawns exist', () => {
            const game = buildGame(buildGridWith([]));
            expect(service.extractSpawnPositions(game)).toEqual([]);
        });
    });

    // ─── removeUnusedSpawns ───────────────────────────────────────────────────

    describe('removeUnusedSpawns', () => {
        /** Clears spawn items from tiles that are not assigned to any of the participating players. */
        it('should nullify item for spawn tiles beyond playerCount', () => {
            const game = buildGame(buildGridWith([
                { row: 0, col: 0, item: TileItem.Spawn },
                { row: 0, col: 1, item: TileItem.Spawn },
                { row: 0, col: 2, item: TileItem.Spawn },
            ]));
            const spawns = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
            service.removeUnusedSpawns(game, spawns, 2);
            expect(game.grid[0][2].item).toBeNull();
        });

        /** Keeps the items on spawn tiles that are assigned to active players. */
        it('should keep spawns used by active players', () => {
            const game = buildGame(buildGridWith([
                { row: 0, col: 0, item: TileItem.Spawn },
                { row: 0, col: 1, item: TileItem.Spawn },
            ]));
            const spawns = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
            service.removeUnusedSpawns(game, spawns, 2);
            expect(game.grid[0][0].item).toBe(TileItem.Spawn);
            expect(game.grid[0][1].item).toBe(TileItem.Spawn);
        });
    });

    // ─── computeTurnOrder ─────────────────────────────────────────────────────

    describe('computeTurnOrder', () => {
        /** Places the fastest player first in the turn order without randomisation. */
        it('should place the fastest player first', () => {
            const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B, FAST_SPEED)];
            const order = service.computeTurnOrder(players);
            expect(order[0]).toBe(SOCKET_B);
        });

        /** Returns a list containing all player socket IDs after sorting. */
        it('should return all player socket IDs', () => {
            const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B), buildPlayer(SOCKET_C)];
            const order = service.computeTurnOrder(players);
            expect(order.length).toBe(PLAYER_COUNT);
            expect(order).toContain(SOCKET_A);
            expect(order).toContain(SOCKET_B);
            expect(order).toContain(SOCKET_C);
        });

        /** Returns an empty array when no players are provided. */
        it('should return empty array for no players', () => {
            expect(service.computeTurnOrder([])).toEqual([]);
        });
    });

    // ─── shuffle ──────────────────────────────────────────────────────────────

    describe('shuffle', () => {
        /** Returns a shuffled array that contains the same elements as the original. */
        it('should return an array with the same elements as the input', () => {
            const original = [PLAYER_COUNT, DEFAULT_SPEED, GRID_SIZE, DEFAULT_LIFE, FAST_SPEED];
            const shuffled = service.shuffle([...original]);
            expect(shuffled.length).toBe(original.length);
            for (const item of original) {
                expect(shuffled).toContain(item);
            }
        });

        /** Returns an empty array when given an empty input. */
        it('should return empty array for empty input', () => {
            expect(service.shuffle([])).toEqual([]);
        });

        /** Returns a single-element array unchanged. */
        it('should return single-element array unchanged', () => {
            expect(service.shuffle([SINGLE_ELEMENT])).toEqual([SINGLE_ELEMENT]);
        });
    });

    // ─── extractSanctuaryPositions ────────────────────────────────────────────

    describe('extractSanctuaryPositions', () => {
        /** Correctly separates healing and combat sanctuary tile positions into distinct map entries. */
        it('should separate healing and combat sanctuary positions', () => {
            const game = buildGame(buildGridWith([
                { row: 0, col: 0, item: TileItem.HealingSanctuary },
                { row: 1, col: 1, item: TileItem.CombatSanctuary },
            ]));
            const result = service.extractSanctuaryPositions(game);
            expect(result.get(TileItem.HealingSanctuary)?.length).toBe(1);
            expect(result.get(TileItem.CombatSanctuary)?.length).toBe(1);
        });

        /** Returns empty arrays for both types when the grid has no sanctuary tiles. */
        it('should return empty arrays when no sanctuaries exist', () => {
            const game = buildGame(buildGridWith([]));
            const result = service.extractSanctuaryPositions(game);
            expect(result.get(TileItem.HealingSanctuary)?.length).toBe(0);
            expect(result.get(TileItem.CombatSanctuary)?.length).toBe(0);
        });
    });

    // ─── extractDoorPositions ─────────────────────────────────────────────────

    describe('extractDoorPositions', () => {
        /** Returns both open and closed door positions from the grid. */
        it('should return positions of both door types', () => {
            const game = buildGame(buildGridWith([
                { row: 0, col: 0, type: TileTexture.DoorClosed },
                { row: 1, col: 2, type: TileTexture.DoorOpened },
            ]));
            const result = service.extractDoorPositions(game);
            expect(result.length).toBe(2);
            expect(result).toContainEqual(expect.objectContaining({ x: 0, y: 0 }));
            expect(result).toContainEqual(expect.objectContaining({ x: 2, y: 1 }));
        });

        /** Returns an empty array when the grid contains no door tiles. */
        it('should return empty array when no doors exist', () => {
            const game = buildGame(buildGridWith([]));
            expect(service.extractDoorPositions(game)).toEqual([]);
        });
    });
});
