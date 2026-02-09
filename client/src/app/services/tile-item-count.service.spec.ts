import type { Game } from '@app/interfaces/game';
import type { Tile } from '@app/interfaces/tile';
import {
  MAP_LARGE_SIZE,
  MAP_MEDIUM_SIZE,
  MAP_SMALL_SIZE,
  SANCTUARY_COUNT_LARGE,
  SANCTUARY_COUNT_MEDIUM,
  SANCTUARY_COUNT_SMALL,
  SPAWN_COUNT_LARGE,
  SPAWN_COUNT_MEDIUM,
  SPAWN_COUNT_SMALL,
} from '@app/constants/game.constants';
import { TileItemCountService } from '@app/services/tile-item-count.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';

const grid = (rows: number, cols: number): Tile[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
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

  it('returns required counts based on map size and mode', () => {
    expect(service.getRequiredSpawnCount(gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE))).toBe(SPAWN_COUNT_SMALL);
    expect(service.getRequiredSpawnCount(gameFactory(MAP_MEDIUM_SIZE, MAP_MEDIUM_SIZE))).toBe(SPAWN_COUNT_MEDIUM);
    expect(service.getRequiredSpawnCount(gameFactory(MAP_LARGE_SIZE, MAP_LARGE_SIZE))).toBe(SPAWN_COUNT_LARGE);
    expect(() => service.getRequiredSpawnCount(gameFactory(SIZE_INVALID_ELEVEN, SIZE_INVALID_ELEVEN))).toThrow();

    expect(service.getRequiredFlagCount(gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE, GameMode.Classic))).toBe(0);
    expect(service.getRequiredFlagCount(gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE, GameMode.Ctf))).toBe(1);
    expect(() =>
      service.getRequiredFlagCount(gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE, 'invalid' as unknown as GameMode)),
    ).toThrow();

    expect(service.getRequiredHealingSanctuaryCount(gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE))).toBe(
      SANCTUARY_COUNT_SMALL,
    );
    expect(service.getRequiredHealingSanctuaryCount(gameFactory(MAP_MEDIUM_SIZE, MAP_MEDIUM_SIZE))).toBe(
      SANCTUARY_COUNT_MEDIUM,
    );
    expect(service.getRequiredHealingSanctuaryCount(gameFactory(MAP_LARGE_SIZE, MAP_LARGE_SIZE))).toBe(
      SANCTUARY_COUNT_LARGE,
    );
    expect(() =>
      service.getRequiredHealingSanctuaryCount(gameFactory(SIZE_INVALID_TWELVE, SIZE_INVALID_TWELVE)),
    ).toThrow();

    expect(service.getRequiredCombatSanctuaryCount(gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE))).toBe(
      SANCTUARY_COUNT_SMALL,
    );
    expect(service.getRequiredCombatSanctuaryCount(gameFactory(MAP_MEDIUM_SIZE, MAP_MEDIUM_SIZE))).toBe(
      SANCTUARY_COUNT_MEDIUM,
    );
    expect(service.getRequiredCombatSanctuaryCount(gameFactory(MAP_LARGE_SIZE, MAP_LARGE_SIZE))).toBe(
      SANCTUARY_COUNT_LARGE,
    );
    expect(() =>
      service.getRequiredCombatSanctuaryCount(gameFactory(SIZE_INVALID_TWELVE, SIZE_INVALID_TWELVE)),
    ).toThrow();
  });

  it('counts textures and placed items correctly', () => {
    const game = gameFactory(MAP_SMALL_SIZE, MAP_SMALL_SIZE, GameMode.Ctf);

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
});
