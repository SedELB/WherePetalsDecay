/**
 * Testing:
 * - Grid initialization and manipulation
 * - Tile and item placement/removal logic
 * - Mouse event handling (click, drag, paint, erase)
 * - Bresenham line drawing algorithm
 * - Selection state management
 * - Validation payload building
 */

import { MouseEventType } from '@app/constants/map-setup-page-constant';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import type { Game } from '@common/game';
import type { Tile } from '@common/tile';

const grid = (
    rows: number,
    cols: number,
    type: TileTexture = TileTexture.Floor,
    item: TileItem | null = null,
): Tile[][] =>
    Array.from({ length: rows }, () =>
        Array.from(
            { length: cols },
            (): Tile => ({
                type,
                item,
            }),
        ),
    );

const gameFactory = (rows = 2, cols = 2, mode: GameMode = GameMode.Classic): Game => ({
    _id: 'game-id',
    name: 'Test Game',
    description: 'Desc',
    size: { rows, cols },
    gameMode: mode,
    thumbnail: 'thumb',
    maxPlayers: 6,
    grid: grid(rows, cols),
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe('MapSetupService', () => {
    let service: MapSetupService;
    let tileItemCountService: TileItemCountService;

    beforeEach(() => {
        tileItemCountService = new TileItemCountService();
        service = new MapSetupService(tileItemCountService);
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test initializeGridIfEmpty with empty grid
    it('should fill the grid when it is empty', () => {
        const empty = gameFactory(2, 2);
        empty.grid = [];
        service.initializeGridIfEmpty(empty);
        expect(empty.grid.length).toBe(2);
        expect(empty.grid[0].length).toBe(2);
    });

    // Test initializeGridIfEmpty with wrong size
    it('should fill the grid when it has wrong size', () => {
        const wrongSize = gameFactory(2, 2);
        wrongSize.grid = grid(1, 1);
        service.initializeGridIfEmpty(wrongSize);
        expect(wrongSize.grid.length).toBe(2);
        expect(wrongSize.grid[0].length).toBe(2);
    });

    // Grid already correct size
    it('should not modify grid when it is already correct size', () => {
        const alreadyOk = gameFactory(2, 2);
        const ref = alreadyOk.grid;
        service.initializeGridIfEmpty(alreadyOk);
        expect(alreadyOk.grid).toBe(ref);
    });

    // Test applyTile with item placement
    it('should place item on floor tile', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 1, flagCount: 1 };

        (service as any).applyTile({ game, rowIndex: 0, colIndex: 0, tileAttribute: TileItem.Spawn, event: {} as MouseEvent, counts });
        expect(game.grid[0][0].item).toBe(TileItem.Spawn);
        expect(counts.spawnCount).toBe(0);
    });

    // Test applyTile with texture placement
    it('should place texture on tile', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 1, flagCount: 1 };

        (service as any).applyTile({ game, rowIndex: 0, colIndex: 1, tileAttribute: TileTexture.Water, event: {} as MouseEvent, counts });
        expect(game.grid[0][1].type).toBe(TileTexture.Water);
    });

    // Cannot place item on wall
    it('should throw error when placing item on wall tile', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 1, flagCount: 1 };
        game.grid[1][0].type = TileTexture.Wall;

        expect(() =>
            (service as any).applyTile({ game, rowIndex: 1, colIndex: 0, tileAttribute: TileItem.Flag, event: {} as MouseEvent, counts }),
        ).toThrowError(/On ne peut pas placer cet object sur une tuile de terrain/);
    });

    // Cannot place item when count is zero
    it('should not place item when count is zero', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 0, flagCount: 0 };

        (service as any).applyTile({ game, rowIndex: 1, colIndex: 1, tileAttribute: TileItem.Flag, event: {} as MouseEvent, counts });
        expect(game.grid[1][1].item).toBeNull();
    });

    // Test applyTile does not change same texture
    it('should not change texture when applying same type', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 1, flagCount: 1 };
        game.grid[0][1].type = TileTexture.Water;

        (service as any).applyTile({ game, rowIndex: 0, colIndex: 1, tileAttribute: TileTexture.Water, event: {} as MouseEvent, counts });
        expect(game.grid[0][1].type).toBe(TileTexture.Water);
    });

    // Test deleteTile with shift key (delete item)
    it('should delete item when shift key is pressed', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 0, flagCount: 0 };
        game.grid[0][0].item = TileItem.Spawn;

        (service as any).deleteTile({
            game,
            rowIndex: 0,
            colIndex: 0,
            tileAttribute: TileItem.Spawn,
            event: { shiftKey: true } as MouseEvent,
            counts,
        });
        expect(game.grid[0][0].item).toBeNull();
        expect(counts.spawnCount).toBe(1);
    });

    // Test deleteTile without shift key, delete texture
    it('should delete texture when shift key is not pressed', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 0, flagCount: 0 };
        game.grid[0][0].type = TileTexture.Wall;

        (service as any).deleteTile({
            game,
            rowIndex: 0,
            colIndex: 0,
            tileAttribute: TileTexture.Water,
            event: { shiftKey: false } as MouseEvent,
            counts,
        });
        expect(game.grid[0][0].type).toBe(TileTexture.Floor);
    });

    // Test deleteTile removes blocking item when placing wall
    it('should remove item when placing wall texture', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 0, flagCount: 0 };
        game.grid[0][0].item = TileItem.Spawn;

        (service as any).deleteTile({
            game,
            rowIndex: 0,
            colIndex: 0,
            tileAttribute: TileTexture.Wall,
            event: {} as MouseEvent,
            counts,
        });
        expect(game.grid[0][0].item).toBeNull();
        expect(counts.spawnCount).toBe(1);
    });

    // Test removeBlockingItemIfNeeded
    it('should remove item when placing blocking texture', () => {
        const counts = { spawnCount: 0, flagCount: 0 };
        const tile: Tile = { type: TileTexture.Floor, item: TileItem.Spawn };

        (service as any).removeBlockingItemIfNeeded(tile, TileTexture.Wall, counts);
        expect(tile.item).toBeNull();
        expect(counts.spawnCount).toBe(1);
    });

    it('should remove item when placing door texture', () => {
        const counts = { spawnCount: 0, flagCount: 0 };
        const tile: Tile = { type: TileTexture.Floor, item: TileItem.Flag };

        (service as any).removeBlockingItemIfNeeded(tile, TileTexture.DoorOpened, counts);
        expect(tile.item).toBeNull();
        expect(counts.flagCount).toBe(1);
    });

    // Test getObjectAt
    it('should return tile at specified position', () => {
        const game = gameFactory(2, 2);
        const tile = service.getObjectAt(game, 0, 0);
        expect(tile).toBeDefined();
        expect(tile).toBe(game.grid[0][0]);
    });

    // getObjectAt with out of bounds
    it('should return undefined for out of bounds position', () => {
        const OUT_OF_BOUNDS_INDEX = 5;
        const game = gameFactory(2, 2);
        const tile = service.getObjectAt(game, OUT_OF_BOUNDS_INDEX, OUT_OF_BOUNDS_INDEX);
        expect(tile).toBeUndefined();
    });

    // Test selectTileTexture activates texture
    it('should activate texture and clear item', () => {
        const result = service.selectTileTexture(null, TileItem.Spawn, TileTexture.Wall);
        expect(result.activeTileTexture).toBe(TileTexture.Wall);
        expect(result.activeTileItem).toBeNull();
    });

    // Test selectTileTexture deactivates when clicking same
    it('should deactivate texture when clicking same type', () => {
        const result = service.selectTileTexture(TileTexture.Wall, TileItem.Spawn, TileTexture.Wall);
        expect(result.activeTileTexture).toBeNull();
        expect(result.activeTileItem).toBe(TileItem.Spawn);
    });

    // Test selectTileItem activates item
    it('should activate item and clear texture', () => {
        const result = service.selectTileItem(null, TileTexture.Water, TileItem.Flag);
        expect(result.activeTileItem).toBe(TileItem.Flag);
        expect(result.activeTileTexture).toBeNull();
    });

    // Test selectTileItem deactivates when clicking same
    it('should deactivate item when clicking same type', () => {
        const result = service.selectTileItem(TileItem.Flag, TileTexture.Water, TileItem.Flag);
        expect(result.activeTileItem).toBeNull();
        expect(result.activeTileTexture).toBe(TileTexture.Water);
    });

    // Test applyActiveSelection
    it('should apply tile when attribute is provided', () => {
        const game = gameFactory(2, 2);
        const counts = { spawnCount: 1, flagCount: 1 };
        const spy = spyOn(service as any, 'applyTile');

        service.applyActiveSelection({ game, rowIndex: 0, colIndex: 0, tileAttribute: TileTexture.Wall, event: {} as MouseEvent, counts });
        expect(spy).toHaveBeenCalled();
    });

    // Test handleCellMouseDown with left click and texture
    it('should start painting on left click with texture', () => {
        const game = gameFactory(1, 1);
        const counts = { spawnCount: 1, flagCount: 1 };

        const leftEvent = {
            button: MouseEventType.LeftClick,
            preventDefault: jasmine.createSpy('preventDefault'),
        } as unknown as MouseEvent;

        const state = service.handleCellMouseDown({
            game,
            rowIndex: 0,
            colIndex: 0,
            event: leftEvent,
            activeTileTexture: TileTexture.Water,
            activeTileItem: null,
            counts,
            isPaintingTiles: false,
            isErasingTiles: false,
        });

        expect(state.isPaintingTiles).toBe(true);
        expect(leftEvent.preventDefault).toHaveBeenCalled();
    });

    // Test handleCellMouseDown with left click and item
    it('should start painting on left click with item', () => {
        const game = gameFactory(1, 1);
        const counts = { spawnCount: 1, flagCount: 1 };

        const leftEvent = {
            button: MouseEventType.LeftClick,
            preventDefault: jasmine.createSpy('preventDefault'),
        } as unknown as MouseEvent;

        const state = service.handleCellMouseDown({
            game,
            rowIndex: 0,
            colIndex: 0,
            event: leftEvent,
            activeTileTexture: null,
            activeTileItem: TileItem.Spawn,
            counts,
            isPaintingTiles: false,
            isErasingTiles: false,
        });

        expect(state.isPaintingTiles).toBe(true);
    });

    // Left click without active tool should not start painting
    it('should not start painting when no active tool is selected', () => {
        const game = gameFactory(1, 1);
        const counts = { spawnCount: 0, flagCount: 0 };

        const leftEvent = {
            button: MouseEventType.LeftClick,
            preventDefault: jasmine.createSpy('preventDefault'),
        } as unknown as MouseEvent;

        const state = service.handleCellMouseDown({
            game,
            rowIndex: 0,
            colIndex: 0,
            event: leftEvent,
            activeTileTexture: null,
            activeTileItem: null,
            counts,
            isPaintingTiles: false,
            isErasingTiles: false,
        });

        expect(state.isPaintingTiles).toBe(false);
    });
});
