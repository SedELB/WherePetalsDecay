import type { Game } from '@app/interfaces/game';
import type { Tile } from '@app/interfaces/tile';
import { MouseEventType } from '@app/pages/map-setup-page/map-setup-page-constant';
import { MapSetupService } from '@app/services/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';

const grid = (
  rows: number,
  cols: number,
  type: TileTexture = TileTexture.Floor,
  item: TileItem | null = null,
): Tile[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      type,
      item,
    })),
  );

const SIZE_SMALL = 10;

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

describe('MapSetupService', () => {
  let service: MapSetupService;
  let tileItemCountService: TileItemCountService;

  beforeEach(() => {
    tileItemCountService = new TileItemCountService();
    service = new MapSetupService(tileItemCountService);
  });

  it('fills the grid when it is missing or the wrong size', () => {
    const empty = gameFactory(2, 2);
    empty.grid = [];
    service.initializeGridIfEmpty(empty);
    expect(empty.grid.length).toBe(2);

    const wrongSize = gameFactory(2, 2);
    wrongSize.grid = grid(1, 1);
    service.initializeGridIfEmpty(wrongSize);
    expect(wrongSize.grid.length).toBe(2);

    const alreadyOk = gameFactory(2, 2);
    const ref = alreadyOk.grid;
    service.initializeGridIfEmpty(alreadyOk);
    expect(alreadyOk.grid).toBe(ref);
  });


  it('places and removes both textures and items', () => {
    const game = gameFactory(2, 2);
    const counts = { spawnCount: 1, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 1 };

    service.applyTile(game, 0, 0, TileItem.Spawn, counts);
    expect(game.grid[0][0].item).toBe(TileItem.Spawn);
    expect(counts.spawnCount).toBe(0);

    service.applyTile(game, 0, 1, TileTexture.Water, counts);
    expect(game.grid[0][1].type).toBe(TileTexture.Water);

    game.grid[1][0].type = TileTexture.Wall;
    expect(() => service.applyTile(game, 1, 0, TileItem.Flag, counts)).toThrow();

    service.applyTile(game, 1, 1, TileItem.Flag, { ...counts, flagCount: 0 });
    expect(game.grid[1][1].item).toBeNull();

    game.grid[0][1].type = TileTexture.Water;
    service.applyTile(game, 0, 1, TileTexture.Water, counts);
    expect(game.grid[0][1].type).toBe(TileTexture.Water);

    game.grid[0][0].item = TileItem.Spawn;
    service.deleteTile({
      game,
      rowIndex: 0,
      colIndex: 0,
      tileAttribute: TileItem.Spawn,
      event: { shiftKey: true } as MouseEvent,
      counts,
    });
    expect(game.grid[0][0].item).toBeNull();

    game.grid[0][0].type = TileTexture.Wall;
    service.deleteTile({
      game,
      rowIndex: 0,
      colIndex: 0,
      tileAttribute: TileTexture.Water,
      event: { shiftKey: false } as MouseEvent,
      counts,
    });
    expect(game.grid[0][0].type).toBe(TileTexture.Floor);
  });

  it('toggles the active selection (texture vs item)', () => {
    const pickedTexture = service.selectTileTexture(null, TileItem.Spawn, TileTexture.Wall);
    expect(pickedTexture.activeTileTexture).toBe(TileTexture.Wall);
    expect(pickedTexture.activeTileItem).toBeNull();

    const clearedTexture = service.selectTileTexture(TileTexture.Wall, TileItem.Spawn, TileTexture.Wall);
    expect(clearedTexture.activeTileTexture).toBeNull();
    expect(clearedTexture.activeTileItem).toBe(TileItem.Spawn);

    const pickedItem = service.selectTileItem(null, TileTexture.Water, TileItem.Flag);
    expect(pickedItem.activeTileItem).toBe(TileItem.Flag);
    expect(pickedItem.activeTileTexture).toBeNull();

    const clearedItem = service.selectTileItem(TileItem.Flag, TileTexture.Water, TileItem.Flag);
    expect(clearedItem.activeTileItem).toBeNull();
    expect(clearedItem.activeTileTexture).toBe(TileTexture.Water);
  });

  it('mouse down starts paint/erase depending on the button', () => {
    const game = gameFactory(1, 1);
    const counts = { spawnCount: 1, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 1 };

    const applySpy = spyOn(service, 'applyTile').and.callThrough();
    const deleteSpy = spyOn(service, 'deleteTile').and.callThrough();

    const leftEvent = { button: MouseEventType.LeftClick } as MouseEvent;

    const leftTextureState = service.handleCellMouseDown({
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
    expect(leftTextureState.isPaintingTiles).toBeTrue();

    const leftItemState = service.handleCellMouseDown({
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
    expect(leftItemState.isPaintingTiles).toBeTrue();

    const rightEvent = {
      button: MouseEventType.RightClick,
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as MouseEvent;

    const rightTextureState = service.handleCellMouseDown({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: rightEvent,
      activeTileTexture: TileTexture.Water,
      activeTileItem: null,
      counts,
      isPaintingTiles: false,
      isErasingTiles: false,
    });
    expect(rightEvent.preventDefault).toHaveBeenCalled();
    expect(rightTextureState.isErasingTiles).toBeTrue();

    const rightItemEvent = {
      button: MouseEventType.RightClick,
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as MouseEvent;

    const rightItemState = service.handleCellMouseDown({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: rightItemEvent,
      activeTileTexture: null,
      activeTileItem: TileItem.Spawn,
      counts,
      isPaintingTiles: false,
      isErasingTiles: false,
    });
    expect(rightItemEvent.preventDefault).toHaveBeenCalled();
    expect(rightItemState.isErasingTiles).toBeTrue();

    const ignoreOtherButton = service.handleCellMouseDown({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { button: 1 } as MouseEvent,
      activeTileTexture: null,
      activeTileItem: null,
      counts,
      isPaintingTiles: true,
      isErasingTiles: true,
    });

    expect(ignoreOtherButton.isPaintingTiles).toBeTrue();
    expect(ignoreOtherButton.isErasingTiles).toBeTrue();

    expect(applySpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('mouse enter keeps painting/erasing while dragging', () => {
    const game = gameFactory(1, 1);
    const counts = { spawnCount: 1, flagCount: 1 };

    // Set up grid with an item and texture for deletion tests
    game.grid[0][0].item = TileItem.Spawn;
    game.grid[0][0].type = TileTexture.Water;

    const deleteSpy = spyOn(service, 'deleteTile').and.callThrough();
    const removeSpy = spyOn(service, 'removeBlockingItemIfNeeded').and.callThrough();
    const applySpy = spyOn(service, 'applyTile').and.callThrough();

    const stopErasing = service.handleCellMouseEnter({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { buttons: 0 } as MouseEvent,
      activeTileTexture: TileTexture.Water,
      activeTileItem: null,
      counts,
      isPaintingTiles: false,
      isErasingTiles: true,
    });
    expect(stopErasing.isErasingTiles).toBeFalse();

    service.handleCellMouseEnter({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { buttons: MouseEventType.RightDrag, shiftKey: true } as MouseEvent,
      activeTileTexture: null,
      activeTileItem: TileItem.Spawn,
      counts,
      isPaintingTiles: false,
      isErasingTiles: true,
    });

    service.handleCellMouseEnter({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { buttons: MouseEventType.RightDrag, shiftKey: false } as MouseEvent,
      activeTileTexture: TileTexture.Water,
      activeTileItem: null,
      counts,
      isPaintingTiles: false,
      isErasingTiles: true,
    });
    expect(deleteSpy).toHaveBeenCalledTimes(2);

    const notPainting = service.handleCellMouseEnter({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { buttons: MouseEventType.LeftDrag } as MouseEvent,
      activeTileTexture: TileTexture.Water,
      activeTileItem: null,
      counts,
      isPaintingTiles: false,
      isErasingTiles: false,
    });
    expect(notPainting.isPaintingTiles).toBeFalse();

    const stopPainting = service.handleCellMouseEnter({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { buttons: 0 } as MouseEvent,
      activeTileTexture: TileTexture.Water,
      activeTileItem: null,
      counts,
      isPaintingTiles: true,
      isErasingTiles: false,
    });
    expect(stopPainting.isPaintingTiles).toBeFalse();

    const keepPainting = service.handleCellMouseEnter({
      game,
      rowIndex: 0,
      colIndex: 0,
      event: { buttons: MouseEventType.LeftDrag } as MouseEvent,
      activeTileTexture: TileTexture.Wall,
      activeTileItem: null,
      counts,
      isPaintingTiles: true,
      isErasingTiles: false,
    });

    expect(keepPainting.isPaintingTiles).toBeTrue();
    expect(removeSpy).toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalled();
  });

  it('resets state and builds the validation payload', () => {
    const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Ctf);
    game.grid[0][0] = { type: TileTexture.Wall, item: TileItem.Spawn } as Tile;

    expect(service.resetInteractionState()).toEqual({ isPaintingTiles: false, isErasingTiles: false });
    expect(service.resetSelection()).toEqual({ activeTileTexture: null, activeTileItem: null });

    service.resetGrid(game);
    expect(game.grid[0][0].type).toBe(TileTexture.Floor);
    expect(game.grid[0][0].item).toBeNull();

    const resetResult = service.resetMap(game);
    expect(resetResult.itemCounts.flagCount).toBe(1);

    const gridTypes = service.extractGridTypes(game);
    const placedObjects = service.extractPlacedObjects(game);
    const payload = service.buildValidationPayload(game);

    expect(gridTypes.length).toBe(SIZE_SMALL);
    expect(placedObjects.length).toBe(0);
    expect(payload.mode).toBe(game.gameMode);
    expect(payload.size).toEqual(game.size);
    expect(service.getObjectAt(game, 0, 0)).toBeDefined();
  });
});
