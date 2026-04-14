/**
 * Testing:
 * - Required count calculations for different map sizes and game modes
 * - Tile and item counting on grid
 * - Item count management (increase, decrease, verify)
 * - Object placement completion checks
 */

import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { GameMode, GridSizes, MaxPlayers, SanctuaryCount, TileItem, TileTexture } from '@common/enums';
import type { Game } from '@common/game';
import type { Tile } from '@common/tile';

const grid = (rows: number, cols: number): Tile[][] =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, (): Tile => ({
            type: TileTexture.Floor,
            item: null,
        })),
    );

const SIZE_INVALID_ELEVEN = 11;
const SIZE_INVALID_TWELVE = 12;

const gameFactory = (rows = 2, cols = 2, mode: GameMode = GameMode.Classic): Game => ({
    _id: 'game-id',
    name: 'Test Game',
    description: 'Desc',
    size: { rows, cols },
    gameMode: mode,
    thumbnail: 'thumb',
    maxPlayers: 4,
    grid: grid(rows, cols),
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe('TileItemCountService', () => {
    let service: TileItemCountService;

    beforeEach(() => {
        service = new TileItemCountService();
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test getRequiredSpawnCount for all map sizes
    it('should return correct spawn count for small map', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        expect(service.getRequiredSpawnCount(game)).toBe(MaxPlayers.Small);
    });

    it('should return correct spawn count for medium map', () => {
        const game = gameFactory(GridSizes.Medium, GridSizes.Medium);
        expect(service.getRequiredSpawnCount(game)).toBe(MaxPlayers.Medium);
    });

    it('should return correct spawn count for large map', () => {
        const game = gameFactory(GridSizes.Large, GridSizes.Large);
        expect(service.getRequiredSpawnCount(game)).toBe(MaxPlayers.Large);
    });

    // Invalid map size for spawn count
    it('should throw error for not supported map size for spawn count', () => {
        const game = gameFactory(SIZE_INVALID_ELEVEN, SIZE_INVALID_ELEVEN);
        expect(() => service.getRequiredSpawnCount(game)).toThrowError(/SpawnCount/);
    });

    // Test getRequiredFlagCount for different game modes
    it('should return zero flags for Classic mode', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Classic);
        expect(service.getRequiredFlagCount(game)).toBe(0);
    });

    it('should return one flag for CTF mode', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Ctf);
        expect(service.getRequiredFlagCount(game)).toBe(1);
    });

    // Invalid game mode for flag count
    it('should throw error for unsupported game mode for flag count', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small, 'invalid' as unknown as GameMode);
        expect(() => service.getRequiredFlagCount(game)).toThrowError(/GameMode/);
    });

    // Test getRequiredHealingSanctuaryCount for all map sizes
    it('should return correct healing sanctuary count for small map', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        expect(service['getRequiredHealingSanctuaryCount'](game)).toBe(SanctuaryCount.Small);
    });

    it('should return correct healing sanctuary count for medium map', () => {
        const game = gameFactory(GridSizes.Medium, GridSizes.Medium);
        expect(service['getRequiredHealingSanctuaryCount'](game)).toBe(SanctuaryCount.Medium);
    });

    it('should return correct healing sanctuary count for large map', () => {
        const game = gameFactory(GridSizes.Large, GridSizes.Large);
        expect(service['getRequiredHealingSanctuaryCount'](game)).toBe(SanctuaryCount.Large);
    });

    // Invalid map size for healing sanctuary
    it('should throw error for unsupported map size for healing sanctuary', () => {
        const game = gameFactory(SIZE_INVALID_TWELVE, SIZE_INVALID_TWELVE);
        expect(() => service['getRequiredHealingSanctuaryCount'](game)).toThrowError(/HealingSanctuary/);
    });

    // Test getRequiredCombatSanctuaryCount for all map sizes
    it('should return correct combat sanctuary count for small map', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        expect(service['getRequiredCombatSanctuaryCount'](game)).toBe(SanctuaryCount.Small);
    });

    it('should return correct combat sanctuary count for medium map', () => {
        const game = gameFactory(GridSizes.Medium, GridSizes.Medium);
        expect(service['getRequiredCombatSanctuaryCount'](game)).toBe(SanctuaryCount.Medium);
    });

    it('should return correct combat sanctuary count for large map', () => {
        const game = gameFactory(GridSizes.Large, GridSizes.Large);
        expect(service['getRequiredCombatSanctuaryCount'](game)).toBe(SanctuaryCount.Large);
    });

    // Invalid map size for combat sanctuary
    it('should throw error for unsupported map size for combat sanctuary', () => {
        const game = gameFactory(SIZE_INVALID_TWELVE, SIZE_INVALID_TWELVE);
        expect(() => service['getRequiredCombatSanctuaryCount'](game)).toThrowError(/CombatSanctuary/);
    });

    // Test createRequiredCounts
    it('should create required counts for Classic mode', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Classic);
        const counts = service.createRequiredCounts(game);

        expect(counts.spawnCount).toBe(MaxPlayers.Small);
        expect(counts.flagCount).toBe(0);
    });

    it('should create required counts for CTF mode', () => {
        const game = gameFactory(GridSizes.Medium, GridSizes.Medium, GameMode.Ctf);
        const counts = service.createRequiredCounts(game);

        expect(counts.spawnCount).toBe(MaxPlayers.Medium);
        expect(counts.flagCount).toBe(1);
    });

    // Test countTileTexture
    it('should count wall tiles correctly', () => {
        const EXPECTED_WALL_COUNT = 3;
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].type = TileTexture.Wall;
        game.grid[1][1].type = TileTexture.Wall;
        game.grid[2][2].type = TileTexture.Wall;

        expect(service.countTileTexture(game, TileTexture.Wall)).toBe(EXPECTED_WALL_COUNT);
    });

    it('should count door tiles correctly', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].type = TileTexture.DoorOpened;

        expect(service.countTileTexture(game, TileTexture.DoorOpened)).toBe(1);
    });

    // Count returns zero when no tiles match
    it('should return zero when no matching tiles found', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);

        expect(service.countTileTexture(game, TileTexture.Wall)).toBe(0);
    });

    // Test countTileItem
    it('should count spawn items correctly', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Spawn;

        expect(service.countTileItem(game, TileItem.Spawn)).toBe(2);
    });

    it('should count flag items correctly', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.Flag;

        expect(service.countTileItem(game, TileItem.Flag)).toBe(1);
    });

    it('should count healing sanctuary items correctly', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.HealingSanctuary;

        expect(service.countTileItem(game, TileItem.HealingSanctuary)).toBe(1);
    });

    it('should count combat sanctuary items correctly', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.CombatSanctuary;

        expect(service.countTileItem(game, TileItem.CombatSanctuary)).toBe(1);
    });

    // Count returns zero when no items match
    it('should return zero when no matching items found', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);

        expect(service.countTileItem(game, TileItem.Spawn)).toBe(0);
    });

    // Test getPlacedSpawnCount
    it('should delegate to countTileItem for spawn count', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Spawn;

        expect(service.getPlacedSpawnCount(game)).toBe(2);
    });

    // Test getPlacedFlagCount
    it('should delegate to countTileItem for flag count', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.Flag;

        expect(service.getPlacedFlagCount(game)).toBe(1);
    });

    // Test getPlacedHealingSanctuaryCount
    it('should delegate to countTileItem for healing sanctuary count', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.HealingSanctuary;

        expect(service['getPlacedHealingSanctuaryCount'](game)).toBe(1);
    });

    // Test getPlacedCombatSanctuaryCount
    it('should delegate to countTileItem for combat sanctuary count', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.CombatSanctuary;

        expect(service['getPlacedCombatSanctuaryCount'](game)).toBe(1);
    });

    // Test adjustCountsForExistingItems
    it('should adjust counts based on existing items in grid', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Ctf);
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Flag;

        const counts = { spawnCount: 2, flagCount: 1, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.adjustCountsForExistingItems(game, counts);

        expect(counts.spawnCount).toBe(1);
        expect(counts.flagCount).toBe(0);
    });

    // Test isObjectTypeComplete for all types
    it('should return true when enough spawns are placed', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Spawn;

        expect(service.isObjectTypeComplete(game, TileItem.Spawn)).toBe(true);
    });

    it('should return false when not enough spawns are placed', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        game.grid[0][0].item = TileItem.Spawn;

        expect(service.isObjectTypeComplete(game, TileItem.Spawn)).toBe(false);
    });

    it('should return true when enough flags are placed', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Ctf);
        game.grid[0][0].item = TileItem.Flag;

        expect(service.isObjectTypeComplete(game, TileItem.Flag)).toBe(true);
    });

    it('should return true when enough healing sanctuaries are placed', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        const required = service['getRequiredHealingSanctuaryCount'](game);

        for (let i = 0; i < required; i++) {
            game.grid[i][0].item = TileItem.HealingSanctuary;
        }

        expect(service.isObjectTypeComplete(game, TileItem.HealingSanctuary)).toBe(true);
    });

    it('should return true when enough combat sanctuaries are placed', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        const required = service['getRequiredCombatSanctuaryCount'](game);

        for (let i = 0; i < required; i++) {
            game.grid[i][0].item = TileItem.CombatSanctuary;
        }

        expect(service.isObjectTypeComplete(game, TileItem.CombatSanctuary)).toBe(true);
    });

    // Unknown item type returns false
    it('should return false for unknown item type', () => {
        const game = gameFactory(GridSizes.Small, GridSizes.Small);
        expect(service.isObjectTypeComplete(game, 'unknown' as TileItem)).toBe(false);
    });

    // Test verifyEnoughTileItem
    it('should return true when enough spawn items available', () => {
        const counts = { spawnCount: 1, flagCount: 0, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        expect(service.verifyEnoughTileItem(counts, TileItem.Spawn)).toBe(true);
    });

    it('should return false when no spawn items available', () => {
        const counts = { spawnCount: 0, flagCount: 0, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        expect(service.verifyEnoughTileItem(counts, TileItem.Spawn)).toBe(false);
    });

    it('should return true when enough flag items available', () => {
        const counts = { spawnCount: 0, flagCount: 1, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        expect(service.verifyEnoughTileItem(counts, TileItem.Flag)).toBe(true);
    });

    it('should return false when no flag items available', () => {
        const counts = { spawnCount: 0, flagCount: 0, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        expect(service.verifyEnoughTileItem(counts, TileItem.Flag)).toBe(false);
    });

    // Unknown item type returns false
    it('should return false for unknown item type in verify', () => {
        const counts = { spawnCount: 1, flagCount: 1, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        expect(service.verifyEnoughTileItem(counts, 'invalid' as TileItem)).toBe(false);
    });

    // Test decreaseTileItemCount
    it('should decrease spawn count', () => {
        const INITIAL_SPAWN = 3;
        const EXPECTED_SPAWN = 2;
        const INITIAL_FLAG = 1;
        const counts = { spawnCount: INITIAL_SPAWN, flagCount: INITIAL_FLAG, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.decreaseTileItemCount(counts, TileItem.Spawn);

        expect(counts.spawnCount).toBe(EXPECTED_SPAWN);
        expect(counts.flagCount).toBe(INITIAL_FLAG);
    });

    it('should decrease flag count', () => {
        const INITIAL_SPAWN = 3;
        const INITIAL_FLAG = 1;
        const EXPECTED_FLAG = 0;
        const counts = { spawnCount: INITIAL_SPAWN, flagCount: INITIAL_FLAG, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.decreaseTileItemCount(counts, TileItem.Flag);

        expect(counts.spawnCount).toBe(INITIAL_SPAWN);
        expect(counts.flagCount).toBe(EXPECTED_FLAG);
    });

    // Decreasing unknown item type does nothing
    it('should not change counts for unknown item type in decrease', () => {
        const INITIAL_SPAWN = 3;
        const INITIAL_FLAG = 1;
        const counts = { spawnCount: INITIAL_SPAWN, flagCount: INITIAL_FLAG, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.decreaseTileItemCount(counts, 'invalid' as TileItem);

        expect(counts.spawnCount).toBe(INITIAL_SPAWN);
        expect(counts.flagCount).toBe(INITIAL_FLAG);
    });

    // Test increaseTileItemCount
    it('should increase spawn count', () => {
        const counts = { spawnCount: 1, flagCount: 0, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.increaseTileItemCount(counts, TileItem.Spawn);

        expect(counts.spawnCount).toBe(2);
        expect(counts.flagCount).toBe(0);
    });

    it('should increase flag count', () => {
        const counts = { spawnCount: 1, flagCount: 0, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.increaseTileItemCount(counts, TileItem.Flag);

        expect(counts.spawnCount).toBe(1);
        expect(counts.flagCount).toBe(1);
    });

    // Increasing unknown item type does nothing
    it('should not change counts for unknown item type in increase', () => {
        const counts = { spawnCount: 1, flagCount: 0, healingSanctuaryCount: 0, combatSanctuaryCount: 0 };
        service.increaseTileItemCount(counts, 'invalid' as TileItem);

        expect(counts.spawnCount).toBe(1);
        expect(counts.flagCount).toBe(0);
    });
});
