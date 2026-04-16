import { Injectable } from '@angular/core';
import { TileItemCounts } from '@app/services/map-setup.types';
import { GameMode, GridSizes, MaxPlayers, SanctuaryCount, TileItem, TileTexture } from '@common/enums';
import { Game } from '@common/game';

@Injectable({ providedIn: 'root' })
export class TileItemCountService {
  getRequiredSpawnCount(game: Game): number {
    if (game.size.rows === GridSizes.Small) return MaxPlayers.Small;
    if (game.size.rows === GridSizes.Medium) return MaxPlayers.Medium;
    if (game.size.rows === GridSizes.Large) return MaxPlayers.Large;
    throw new Error('La taille sélectionnée n\u2019est pas actuellement supportée (SpawnCount)');
  }

  getRequiredFlagCount(game: Game): number {
    if (game.gameMode === GameMode.Classic) return 0;
    if (game.gameMode === GameMode.Ctf) return 1;
    throw new Error('Le mode de jeu n\u2019est pas actuellement supporté (GameMode)');
  }

  getMaxHealingSanctuaryCount(game: Game): number {
    if (game.size.rows === GridSizes.Small) return SanctuaryCount.Small;
    if (game.size.rows === GridSizes.Medium) return SanctuaryCount.Medium;
    if (game.size.rows === GridSizes.Large) return SanctuaryCount.Large;
    throw new Error('La taille sélectionnée n\u2019est pas actuellement supportée (HealingSanctuary)');
  }

  getMaxCombatSanctuaryCount(game: Game): number {
    if (game.size.rows === GridSizes.Small) return SanctuaryCount.Small;
    if (game.size.rows === GridSizes.Medium) return SanctuaryCount.Medium;
    if (game.size.rows === GridSizes.Large) return SanctuaryCount.Large;
    throw new Error('La taille sélectionnée n\u2019est pas actuellement supportée (CombatSanctuary)');
  }

  createRequiredCounts(game: Game): TileItemCounts {
    return {
      spawnCount: this.getRequiredSpawnCount(game),
      flagCount: this.getRequiredFlagCount(game),
      healingSanctuaryCount: this.getMaxHealingSanctuaryCount(game),
      combatSanctuaryCount: this.getMaxCombatSanctuaryCount(game),
    };
  }

  countTileItem(game: Game, tileItem: TileItem): number {
    let count = 0;
    game.grid.forEach((row) => (count += row.filter((tile) => tile.item === tileItem).length));
    return count;
  }

  private countSanctuaryBlocks(game: Game, item: TileItem): number {
    let count = 0;
    const con = new Set<string>();
    for (let y = 0; y < game.grid.length; y++) {
      for (let x = 0; x < game.grid[y].length; x++) {
        if (game.grid[y][x].item === item && !con.has(`${x},${y}`)) {
          count++;
          if (game.grid[y]?.[x + 1]?.item === item && game.grid[y + 1]?.[x]?.item === item && game.grid[y + 1]?.[x + 1]?.item === item) {
            con.add(`${x},${y}`).add(`${x + 1},${y}`).add(`${x},${y + 1}`).add(`${x + 1},${y + 1}`);
          } else {
            con.add(`${x},${y}`);
          }
        }
      }
    }
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
    counts.healingSanctuaryCount -= this.countSanctuaryBlocks(game, TileItem.HealingSanctuary);
    counts.combatSanctuaryCount -= this.countSanctuaryBlocks(game, TileItem.CombatSanctuary);
  }

  getPlacedSpawnCount(game: Game): number {
    return this.countTileItem(game, TileItem.Spawn);
  }

  getPlacedFlagCount(game: Game): number {
    return this.countTileItem(game, TileItem.Flag);
  }

  getPlacedHealingSanctuaryCount(game: Game): number {
    return this.countSanctuaryBlocks(game, TileItem.HealingSanctuary);
  }

  getPlacedCombatSanctuaryCount(game: Game): number {
    return this.countSanctuaryBlocks(game, TileItem.CombatSanctuary);
  }

  isObjectTypeComplete(game: Game, type: TileItem): boolean {
    switch (type) {
      case TileItem.Spawn:
        return this.countTileItem(game, type) >= this.getRequiredSpawnCount(game);
      case TileItem.Flag:
        return this.countTileItem(game, type) >= this.getRequiredFlagCount(game);
      case TileItem.HealingSanctuary:
      case TileItem.CombatSanctuary:
        return true;
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
      case TileItem.HealingSanctuary:
        return counts.healingSanctuaryCount > 0;
      case TileItem.CombatSanctuary:
        return counts.combatSanctuaryCount > 0;
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
      case TileItem.HealingSanctuary:
        counts.healingSanctuaryCount--;
        break;
      case TileItem.CombatSanctuary:
        counts.combatSanctuaryCount--;
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
      case TileItem.HealingSanctuary:
        counts.healingSanctuaryCount++;
        break;
      case TileItem.CombatSanctuary:
        counts.combatSanctuaryCount++;
        break;
    }
  }
}
