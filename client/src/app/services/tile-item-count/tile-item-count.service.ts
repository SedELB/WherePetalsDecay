import { Injectable } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { TileItemCounts } from '@app/services/map-setup.types';
import { GameMode, GridSizes, MaxPlayers, SanctuaryCount, TileItem, TileTexture } from '@common/enums';

@Injectable({ providedIn: 'root' })
export class TileItemCountService {
  getRequiredSpawnCount(game: Game): number {
    if (game.size.rows === GridSizes.Small) return MaxPlayers.Small;
    if (game.size.rows === GridSizes.Medium) return MaxPlayers.Medium;
    if (game.size.rows === GridSizes.Large) return MaxPlayers.Large;
    throw new Error('La taille sélectionnée n’est pas actuellement supportée (SpawnCount)');
  }

  getRequiredFlagCount(game: Game): number {
    if (game.gameMode === GameMode.Classic) return 0;
    if (game.gameMode === GameMode.Ctf) return 1;
    throw new Error('Le mode de jeu n’est pas actuellement supporté (GameMode)');
  }

  getRequiredHealingSanctuaryCount(game: Game): number {
    if (game.size.rows === GridSizes.Small) return SanctuaryCount.Small;
    if (game.size.rows === GridSizes.Medium) return SanctuaryCount.Medium;
    if (game.size.rows === GridSizes.Large) return SanctuaryCount.Large;
    throw new Error('La taille sélectionnée n’est pas actuellement supportée (HealingSanctuary)');
  }

  getRequiredCombatSanctuaryCount(game: Game): number {
    if (game.size.rows === GridSizes.Small) return SanctuaryCount.Small;
    if (game.size.rows === GridSizes.Medium) return SanctuaryCount.Medium;
    if (game.size.rows === GridSizes.Large) return SanctuaryCount.Large;
    throw new Error('La taille sélectionnée n’est pas actuellement supportée (CombatSanctuary)');
  }

  createRequiredCounts(game: Game): TileItemCounts {
    return {
      spawnCount: this.getRequiredSpawnCount(game),
      flagCount: this.getRequiredFlagCount(game),
    };
  }

  countTileItem(game: Game, tileItem: TileItem): number {
    let count = 0;
    game.grid.forEach((row) => (count += row.filter((tile) => tile.item === tileItem).length));
    return count;
  }

  countTileTexture(game: Game, tileTexture: TileTexture): number {
    let count = 0;
    game.grid.forEach((row) => (count += row.filter((tile) => tile.type === tileTexture).length));
    return count;
  }

  adjustCountsForExistingItems(game: Game, counts: TileItemCounts): void {
    counts.spawnCount -= this.countTileItem(game, TileItem.Spawn);
    counts.flagCount -= this.countTileItem(game, TileItem.Flag);
  }

  getPlacedSpawnCount(game: Game): number {
    return this.countTileItem(game, TileItem.Spawn);
  }

  getPlacedFlagCount(game: Game): number {
    return this.countTileItem(game, TileItem.Flag);
  }

  getPlacedHealingSanctuaryCount(game: Game): number {
    return this.countTileItem(game, TileItem.HealingSanctuary);
  }

  getPlacedCombatSanctuaryCount(game: Game): number {
    return this.countTileItem(game, TileItem.CombatSanctuary);
  }

  isObjectTypeComplete(game: Game, type: TileItem): boolean {
    const placed = this.countTileItem(game, type);
    switch (type) {
      case TileItem.Spawn:
        return placed >= this.getRequiredSpawnCount(game);
      case TileItem.Flag:
        return placed >= this.getRequiredFlagCount(game);
      case TileItem.HealingSanctuary:
        return placed >= this.getRequiredHealingSanctuaryCount(game);
      case TileItem.CombatSanctuary:
        return placed >= this.getRequiredCombatSanctuaryCount(game);
      default:
        return false;
    }
  }

  verifyEnoughTileItem(counts: TileItemCounts, item: TileItem): boolean {
    switch (item) {
      case TileItem.Spawn:
        return counts.spawnCount > 0;
      case TileItem.Flag:
        return counts.flagCount > 0;
      default:
        return false;
    }
  }

  decreaseTileItemCount(counts: TileItemCounts, item: TileItem): void {
    switch (item) {
      case TileItem.Spawn:
        counts.spawnCount--;
        break;
      case TileItem.Flag:
        counts.flagCount--;
        break;
    }
  }

  increaseTileItemCount(counts: TileItemCounts, item: TileItem): void {
    switch (item) {
      case TileItem.Spawn:
        counts.spawnCount++;
        break;
      case TileItem.Flag:
        counts.flagCount++;
        break;
    }
  }
}
