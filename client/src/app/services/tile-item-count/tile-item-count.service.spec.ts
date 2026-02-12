import type { Game } from '@app/interfaces/game';
import type { Tile } from '@app/interfaces/tile';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { GameMode, GridSizes, MaxPlayers, SanctuaryCount, TileItem, TileTexture } from '@common/enums';

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
    expect(service.getRequiredSpawnCount(gameFactory(GridSizes.Small, GridSizes.Small))).toBe(MaxPlayers.Small);
    expect(service.getRequiredSpawnCount(gameFactory(GridSizes.Medium, GridSizes.Medium))).toBe(MaxPlayers.Medium);
    expect(service.getRequiredSpawnCount(gameFactory(GridSizes.Large, GridSizes.Large))).toBe(MaxPlayers.Large);
    expect(() => service.getRequiredSpawnCount(gameFactory(SIZE_INVALID_ELEVEN, SIZE_INVALID_ELEVEN))).toThrow();

    expect(service.getRequiredFlagCount(gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Classic))).toBe(0);
    expect(service.getRequiredFlagCount(gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Ctf))).toBe(1);
    expect(() =>
      service.getRequiredFlagCount(gameFactory(GridSizes.Small, GridSizes.Small, 'invalid' as unknown as GameMode)),
    ).toThrow();

    expect(service.getRequiredHealingSanctuaryCount(gameFactory(GridSizes.Small, GridSizes.Small))).toBe(
      SanctuaryCount.Small,
    );
    expect(service.getRequiredHealingSanctuaryCount(gameFactory(GridSizes.Medium, GridSizes.Medium))).toBe(
      SanctuaryCount.Medium,
    );
    expect(service.getRequiredHealingSanctuaryCount(gameFactory(GridSizes.Large, GridSizes.Large))).toBe(
      SanctuaryCount.Large,
    );
    expect(() =>
      service.getRequiredHealingSanctuaryCount(gameFactory(SIZE_INVALID_TWELVE, SIZE_INVALID_TWELVE)),
    ).toThrow();

    expect(service.getRequiredCombatSanctuaryCount(gameFactory(GridSizes.Small, GridSizes.Small))).toBe(
      SanctuaryCount.Small,
    );
    expect(service.getRequiredCombatSanctuaryCount(gameFactory(GridSizes.Medium, GridSizes.Medium))).toBe(
      SanctuaryCount.Medium,
    );
    expect(service.getRequiredCombatSanctuaryCount(gameFactory(GridSizes.Large, GridSizes.Large))).toBe(
      SanctuaryCount.Large,
    );
    expect(() =>
      service.getRequiredCombatSanctuaryCount(gameFactory(SIZE_INVALID_TWELVE, SIZE_INVALID_TWELVE)),
    ).toThrow();
  });

  it('counts textures and placed items correctly', () => {
    const game = gameFactory(GridSizes.Small, GridSizes.Small, GameMode.Ctf);

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
    expect(service.verifyEnoughTileItem(counts, TileItem.Flag)).toBeFalse();
    expect(service.verifyEnoughTileItem(counts, 'invalid' as TileItem)).toBeFalse();

    service.decreaseTileItemCount(counts, TileItem.Spawn);
    service.decreaseTileItemCount(counts, TileItem.Flag);

    service.increaseTileItemCount(counts, TileItem.Flag);
    service.increaseTileItemCount(counts, TileItem.Spawn);

    expect(counts.spawnCount).toBe(1);
    expect(counts.flagCount).toBe(0);
  });
});
