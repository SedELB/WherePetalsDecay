/**
 * Test suite for GameStatsService (server-side).
 * This service computes end-of-game statistics from an ActiveGame snapshot:
 * visited tile percentage, sanctuary usage, door manipulation, flag holder count,
 * and total game duration.
 * All tests build minimal ActiveGame objects to exercise each calculation path.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { GameStatsService } from './game-stats.service';
import { ActiveGame } from './active-game.interface';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Tile } from '@common/tile';

// ─── Constants ────────────────────────────────────────────────────────────────
const PERCENT = 100;
const MS_PER_SECOND = 1000;
const DURATION_SECONDS = 5;
const DEFAULT_LIFE = 6;

// ─── Factories ────────────────────────────────────────────────────────────────

const buildTile = (type: TileTexture, item: TileItem | null = null): Tile => ({ type, item });

const buildPlayer = (socketId: string): Player => ({
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
        speed: 4,
        attack: 4,
        defense: 4,
        lifeBonus: false,
        attackDice: 'D6' as Player['character']['attackDice'],
        defenseDice: 'D4' as Player['character']['defenseDice'],
    },
});

const buildLobby = (players: Player[], grid: Tile[][], mode = GameMode.Classic): Lobby => ({
    lobbyId: 'lobby-1',
    gameId: 'game-1',
    hostSocketId: 'socket-a',
    playerCount: players.length,
    isLocked: true,
    players,
    game: {
        _id: 'game-1',
        name: 'Test',
        description: '',
        size: { rows: grid.length, cols: grid[0]?.length ?? 0 },
        gameMode: mode,
        thumbnail: '',
        maxPlayers: 4,
        grid,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    pendingAvatars: {},
    chatHistory: [],
    teamA: [],
    teamB: [],
});

const buildActiveGame = (overrides: Partial<ActiveGame>): ActiveGame => ({
    lobby: buildLobby([], [[buildTile(TileTexture.Floor)]]),
    turnOrder: [],
    currentTurnIndex: 0,
    playerPositions: new Map(),
    playerStartPositions: new Map(),
    movementPoints: new Map(),
    actionPoints: new Map(),
    sanctuaryCooldowns: new Map(),
    playerCombatBonuses: new Map(),
    visitedTilesPerPlayer: new Map(),
    globalVisitedTiles: new Set(),
    sanctuariesUsed: new Set(),
    doorsInteracted: new Set(),
    flagHolders: new Set(),
    totalTurns: 0,
    gameStartTime: Date.now() - DURATION_SECONDS * MS_PER_SECOND,
    sanctuaryPositions: new Map(),
    doorPositions: [],
    ...overrides,
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('GameStatsService', () => {
    let service: GameStatsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GameStatsService],
        }).compile();

        service = module.get<GameStatsService>(GameStatsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ─── gameDurationSeconds ──────────────────────────────────────────────────

    describe('gameDurationSeconds', () => {
        /** Computes the elapsed game duration in whole seconds from start time to now. */
        it('should compute elapsed duration in seconds', () => {
            const game = buildActiveGame({});
            const stats = service.buildGameStats(game);
            expect(stats.gameDurationSeconds).toBeGreaterThanOrEqual(DURATION_SECONDS - 1);
        });
    });

    // ─── totalTurns ───────────────────────────────────────────────────────────

    describe('totalTurns', () => {
        /** Returns the total number of turns that occurred during the game. */
        it('should reflect the totalTurns counter', () => {
            const TURNS = 7;
            const game = buildActiveGame({ totalTurns: TURNS });
            expect(service.buildGameStats(game).totalTurns).toBe(TURNS);
        });
    });

    // ─── visitedTilesPercentage ───────────────────────────────────────────────

    describe('visitedTilesPercentage', () => {
        /** Returns 100% when every terrain tile has been visited at least once. */
        it('should return 100 when all terrain tiles have been visited', () => {
            const grid = [[buildTile(TileTexture.Floor)], [buildTile(TileTexture.Floor)]];
            const game = buildActiveGame({
                lobby: buildLobby([], grid),
                globalVisitedTiles: new Set(['0,0', '0,1']),
            });
            expect(service.buildGameStats(game).visitedTilesPercentage).toBe(PERCENT);
        });

        /** Returns 0% when no terrain tiles have been visited. */
        it('should return 0 when no tiles have been visited', () => {
            const grid = [[buildTile(TileTexture.Floor), buildTile(TileTexture.Floor)]];
            const game = buildActiveGame({
                lobby: buildLobby([], grid),
                globalVisitedTiles: new Set(),
            });
            expect(service.buildGameStats(game).visitedTilesPercentage).toBe(0);
        });

        /** Returns 0% when the grid contains only wall tiles (no walkable terrain). */
        it('should return 0 when grid has only wall tiles', () => {
            const grid = [[buildTile(TileTexture.Wall)]];
            const game = buildActiveGame({ lobby: buildLobby([], grid) });
            expect(service.buildGameStats(game).visitedTilesPercentage).toBe(0);
        });

        /** Counts water and ice tiles as terrain when computing the visit percentage. */
        it('should count water and ice tiles as terrain', () => {
            const grid = [
                [buildTile(TileTexture.Water), buildTile(TileTexture.Ice)],
            ];
            const game = buildActiveGame({
                lobby: buildLobby([], grid),
                globalVisitedTiles: new Set(['0,0']),
            });
            const stats = service.buildGameStats(game);
            expect(stats.visitedTilesPercentage).toBe(PERCENT / 2);
        });
    });

    // ─── sanctuaryUsagePercentage ─────────────────────────────────────────────

    describe('sanctuaryUsagePercentage', () => {
        /** Returns null when the grid has no sanctuary tiles to avoid division by zero. */
        it('should return null when there are no sanctuaries', () => {
            const game = buildActiveGame({ lobby: buildLobby([], [[buildTile(TileTexture.Floor)]]) });
            expect(service.buildGameStats(game).sanctuaryUsagePercentage).toBeNull();
        });

        /** Returns 100% when all sanctuary tiles in the grid have been used. */
        it('should return 100 when all sanctuaries have been used', () => {
            const grid = [[buildTile(TileTexture.Floor, TileItem.HealingSanctuary)]];
            const game = buildActiveGame({
                lobby: buildLobby([], grid),
                sanctuariesUsed: new Set(['0,0']),
            });
            expect(service.buildGameStats(game).sanctuaryUsagePercentage).toBe(PERCENT);
        });
    });

    // ─── doorsManipulatedPercentage ───────────────────────────────────────────

    describe('doorsManipulatedPercentage', () => {
        /** Returns null when the grid has no door tiles. */
        it('should return null when there are no doors', () => {
            const game = buildActiveGame({ lobby: buildLobby([], [[buildTile(TileTexture.Floor)]]) });
            expect(service.buildGameStats(game).doorsManipulatedPercentage).toBeNull();
        });

        /** Returns 100% when all door tiles in the grid have been interacted with. */
        it('should return 100 when all doors have been interacted with', () => {
            const grid = [[buildTile(TileTexture.DoorClosed)]];
            const game = buildActiveGame({
                lobby: buildLobby([], grid),
                doorsInteracted: new Set(['0,0']),
            });
            expect(service.buildGameStats(game).doorsManipulatedPercentage).toBe(PERCENT);
        });

        /** Returns 0% when no door has been interacted with yet. */
        it('should return 0 when no doors have been interacted with', () => {
            const grid = [[buildTile(TileTexture.DoorClosed), buildTile(TileTexture.DoorOpened)]];
            const game = buildActiveGame({
                lobby: buildLobby([], grid),
                doorsInteracted: new Set(),
            });
            expect(service.buildGameStats(game).doorsManipulatedPercentage).toBe(0);
        });
    });

    // ─── uniqueFlagHoldersCount ───────────────────────────────────────────────

    describe('uniqueFlagHoldersCount', () => {
        /** Returns null for classic game mode since flag mechanics do not apply. */
        it('should return null for classic game mode', () => {
            const game = buildActiveGame({
                lobby: buildLobby([], [[buildTile(TileTexture.Floor)]], GameMode.Classic),
                flagHolders: new Set(['socket-a', 'socket-b']),
            });
            expect(service.buildGameStats(game).uniqueFlagHoldersCount).toBeNull();
        });

        /** Returns the count of unique players who held the flag during a CTF game. */
        it('should return the unique flag holder count for CTF mode', () => {
            const HOLDER_COUNT = 3;
            const game = buildActiveGame({
                lobby: buildLobby([], [[buildTile(TileTexture.Floor)]], GameMode.Ctf),
                flagHolders: new Set(['socket-a', 'socket-b', 'socket-c']),
            });
            expect(service.buildGameStats(game).uniqueFlagHoldersCount).toBe(HOLDER_COUNT);
        });

        /** Returns 0 flag holders when no player has ever picked up the flag. */
        it('should return 0 when no players held the flag in CTF', () => {
            const game = buildActiveGame({
                lobby: buildLobby([], [[buildTile(TileTexture.Floor)]], GameMode.Ctf),
                flagHolders: new Set(),
            });
            expect(service.buildGameStats(game).uniqueFlagHoldersCount).toBe(0);
        });
    });

    // ─── visitedTilesCount per player ─────────────────────────────────────────

    describe('per-player visitedTilesCount', () => {
        /** Writes back each player's individual visited tile count from the per-player map. */
        it('should assign visitedTilesCount to each player from the per-player map', () => {
            const TILE_COUNT = 5;
            const player = buildPlayer('socket-a');
            const grid = [[buildTile(TileTexture.Floor)]];
            const visitedTilesPerPlayer = new Map<string, Set<string>>();
            const playerTiles = new Set<string>();
            for (let i = 0; i < TILE_COUNT; i++) {
                playerTiles.add(`${i},0`);
            }
            visitedTilesPerPlayer.set('socket-a', playerTiles);

            const game = buildActiveGame({
                lobby: buildLobby([player], grid),
                visitedTilesPerPlayer,
                globalVisitedTiles: playerTiles,
            });

            service.buildGameStats(game);
            expect(player.visitedTilesCount).toBe(TILE_COUNT);
        });

        /** Sets visitedTilesCount to 0 for players who have not visited any tile. */
        it('should set visitedTilesCount to 0 for players with no recorded tiles', () => {
            const player = buildPlayer('socket-a');
            const grid = [[buildTile(TileTexture.Floor)]];
            const game = buildActiveGame({
                lobby: buildLobby([player], grid),
                visitedTilesPerPlayer: new Map(),
            });
            service.buildGameStats(game);
            expect(player.visitedTilesCount).toBe(0);
        });
    });
});
