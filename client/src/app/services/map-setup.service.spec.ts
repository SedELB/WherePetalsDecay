import type { Game } from '@app/interfaces/game';
import type { Tile } from '@app/interfaces/tile';
import { MOUSE_EVENT } from '@app/pages/map-setup-page/map-setup-page-constant';
import { MapSetupService } from '@app/services/map-setup.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';

const grid = (
  rows: number,
  cols: number,
  type: TileTexture = TileTexture.Floor,
  item: TileItem | null = null
): Tile[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      type,
      item,
    }))
  );

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

  beforeEach(() => {
    service = new MapSetupService();
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

  it('returns required counts based on map size and mode', () => {
    expect(service.getRequiredSpawnCount(gameFactory(10, 10))).toBe(2);
    expect(service.getRequiredSpawnCount(gameFactory(15, 15))).toBe(4);
    expect(service.getRequiredSpawnCount(gameFactory(20, 20))).toBe(6);
    expect(() => service.getRequiredSpawnCount(gameFactory(11, 11))).toThrow();

    expect(service.getRequiredFlagCount(gameFactory(10, 10, GameMode.Classic))).toBe(0);
    expect(service.getRequiredFlagCount(gameFactory(10, 10, GameMode.Ctf))).toBe(1);
    expect(() => service.getRequiredFlagCount(gameFactory(10, 10, 'invalid' as unknown as GameMode))).toThrow();

    expect(service.getRequiredHealingSanctuaryCount(gameFactory(10, 10))).toBe(1);
    expect(service.getRequiredHealingSanctuaryCount(gameFactory(15, 15))).toBe(2);
    expect(service.getRequiredHealingSanctuaryCount(gameFactory(20, 20))).toBe(4);
    expect(() => service.getRequiredHealingSanctuaryCount(gameFactory(12, 12))).toThrow();

    expect(service.getRequiredCombatSanctuaryCount(gameFactory(10, 10))).toBe(1);
    expect(service.getRequiredCombatSanctuaryCount(gameFactory(15, 15))).toBe(2);
    expect(service.getRequiredCombatSanctuaryCount(gameFactory(20, 20))).toBe(4);
    expect(() => service.getRequiredCombatSanctuaryCount(gameFactory(12, 12))).toThrow();
  });

  it('counts textures and placed items correctly', () => {
    const game = gameFactory(10, 10, GameMode.Ctf);

    game.grid[0][0].type = TileTexture.Wall;
    game.grid[0][1].item = TileItem.Spawn;
    game.grid[0][2] = { type: TileTexture.Floor, item: TileItem.Spawn } as Tile;
    game.grid[1][0] = { type: TileTexture.Floor, item: TileItem.HealingSanctuary } as Tile;
    game.grid[1][1] = { type: TileTexture.Floor, item: TileItem.CombatSanctuary } as Tile;
    game.grid[2][0] = { type: TileTexture.Floor, item: TileItem.Flag } as Tile;

    expect(service.countTileTexture(game, TileTexture.Wall)).toBe(1);
    expect(service.countTileItem(game, TileItem.Spawn)).toBe(2);

    expect(service.getPlacedSpawnCount(game)).toBe(2);
    expect(service.getPlacedFlagCount(game)).toBe(1);
    expect(service.getPlacedHealingSanctuaryCount(game)).toBe(1);
    expect(service.getPlacedCombatSanctuaryCount(game)).toBe(1);

    expect(service.isObjectTypeComplete(game, TileItem.Spawn)).toBeTrue();
    expect(service.isObjectTypeComplete(game, TileItem.Flag)).toBeTrue();
    expect(service.isObjectTypeComplete(game, TileItem.HealingSanctuary)).toBeTrue();
    expect(service.isObjectTypeComplete(game, TileItem.CombatSanctuary)).toBeTrue();
    expect(service.isObjectTypeComplete(game, 'unknown' as TileItem)).toBeFalse();
  });

  it('updates remaining item counts when placing/removing items', () => {
    const counts = { spawnCount: 1, healingSanctuaryCount: 0, combatSanctuaryCount: 1, flagCount: 0 };

    expect(service.verifyEnoughTileItem(counts, TileItem.Spawn)).toBeTrue();
    expect(service.verifyEnoughTileItem(counts, TileItem.HealingSanctuary)).toBeFalse();
    expect(service.verifyEnoughTileItem(counts, TileItem.CombatSanctuary)).toBeTrue();
    expect(service.verifyEnoughTileItem(counts, TileItem.Flag)).toBeFalse();
    expect(service.verifyEnoughTileItem(counts, 'invalid' as TileItem)).toBeFalse();

    service.decreaseTileItemCount(counts, TileItem.Spawn);
    service.decreaseTileItemCount(counts, TileItem.CombatSanctuary);
    service.decreaseTileItemCount(counts, TileItem.HealingSanctuary);
    service.decreaseTileItemCount(counts, TileItem.Flag);

    service.increaseTileItemCount(counts, TileItem.HealingSanctuary);
    service.increaseTileItemCount(counts, TileItem.Flag);
    service.increaseTileItemCount(counts, TileItem.Spawn);
    service.increaseTileItemCount(counts, TileItem.CombatSanctuary);

    expect(counts.spawnCount).toBe(1);
    expect(counts.combatSanctuaryCount).toBe(1);
    expect(counts.healingSanctuaryCount).toBe(0);
    expect(counts.flagCount).toBe(0);
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
    service.deleteTile(game, 0, 0, TileItem.Spawn, { shiftKey: true } as MouseEvent, counts);
    expect(game.grid[0][0].item).toBeNull();

    game.grid[0][0].type = TileTexture.Wall;
    service.deleteTile(game, 0, 0, TileTexture.Water, { shiftKey: false } as MouseEvent, counts);
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

    const leftEvent = { button: MOUSE_EVENT.LeftClick } as MouseEvent;

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
      button: MOUSE_EVENT.RightClick,
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
      button: MOUSE_EVENT.RightClick,
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
    const counts = { spawnCount: 1, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 1 };

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
      event: { buttons: MOUSE_EVENT.RightDrag, shiftKey: true } as MouseEvent,
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
      event: { buttons: MOUSE_EVENT.RightDrag, shiftKey: false } as MouseEvent,
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
      event: { buttons: MOUSE_EVENT.LeftDrag } as MouseEvent,
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
      event: { buttons: MOUSE_EVENT.LeftDrag } as MouseEvent,
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
    const game = gameFactory(10, 10, GameMode.Ctf);
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

    expect(gridTypes.length).toBe(10);
    expect(placedObjects.length).toBe(0);
    expect(payload.mode).toBe(game.gameMode);
    expect(payload.size).toEqual(game.size);
    expect(service.getObjectAt(game, 0, 0)).toBeDefined();
  });
});