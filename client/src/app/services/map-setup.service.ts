import { Injectable } from '@angular/core';
import type { PlacedObject } from '@app/interfaces/game';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import {
  MAP_LARGE_SIZE,
  MAP_MEDIUM_SIZE,
  MAP_SMALL_SIZE,
  MOUSE_EVENT,
} from '@app/pages/map-setup-page/map-setup-page-constant';
import type { GameDraftForValidation } from '@app/services/game-validator.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';

export interface TileItemCounts {
  spawnCount: number;
  healingSanctuaryCount: number;
  combatSanctuaryCount: number;
  flagCount: number;
}

export interface MapSetupSelection {
  activeTileTexture: TileTexture | null;
  activeTileItem: TileItem | null;
}

export interface MapSetupInteractionState {
  isPaintingTiles: boolean;
  isErasingTiles: boolean;
}

export interface MapSetupResetResult {
  itemCounts: TileItemCounts;
  selection: MapSetupSelection;
}

@Injectable({ providedIn: 'root' })
export class MapSetupService {
  initializeGridIfEmpty(game: Game): void {
    // If grid is empty or doesn't match the expected size, initialize it
    if (
      !game.grid ||
      game.grid.length === 0 ||
      game.grid.length !== game.size.rows ||
      game.grid[0]?.length !== game.size.cols
    ) {
      game.grid = Array.from({ length: game.size.rows }, () =>
        Array.from({ length: game.size.cols }, (): Tile => ({
          type: TileTexture.Floor,
          item: null,
        }))
      );
    }
  }

  getRequiredSpawnCount(game: Game): number {
    if (game.size.rows === MAP_SMALL_SIZE) return 2;
    if (game.size.rows === MAP_MEDIUM_SIZE) return 4;
    if (game.size.rows === MAP_LARGE_SIZE) return 6;
    throw new Error('The size selected is not currently supported (SpawnCount)');
  }

  getRequiredFlagCount(game: Game): number {
    if (game.gameMode === GameMode.Classic) return 0;
    if (game.gameMode === GameMode.Ctf) return 1;
    throw new Error('The game mode is not currently supported (GameMode)');
  }

  getRequiredHealingSanctuaryCount(game: Game): number {
    if (game.size.rows === MAP_SMALL_SIZE) return 1;
    if (game.size.rows === MAP_MEDIUM_SIZE) return 2;
    if (game.size.rows === MAP_LARGE_SIZE) return 4;
    throw new Error('The size selected is not currently supported (HealingSanctuary)');
  }

  getRequiredCombatSanctuaryCount(game: Game): number {
    if (game.size.rows === MAP_SMALL_SIZE) return 1;
    if (game.size.rows === MAP_MEDIUM_SIZE) return 2;
    if (game.size.rows === MAP_LARGE_SIZE) return 4;
    throw new Error('The size selected is not currently supported (CombatSanctuary)');
  }

  createRequiredCounts(game: Game): TileItemCounts {
    return {
      spawnCount: this.getRequiredSpawnCount(game),
      healingSanctuaryCount: this.getRequiredHealingSanctuaryCount(game),
      combatSanctuaryCount: this.getRequiredCombatSanctuaryCount(game),
      flagCount: this.getRequiredFlagCount(game),
    };
  }

  adjustCountsForExistingItems(game: Game, counts: TileItemCounts): void {
    counts.spawnCount -= this.countTileItem(game, TileItem.Spawn);
    counts.healingSanctuaryCount -= this.countTileItem(game, TileItem.HealingSanctuary);
    counts.combatSanctuaryCount -= this.countTileItem(game, TileItem.CombatSanctuary);
    counts.flagCount -= this.countTileItem(game, TileItem.Flag);
  }

  countTileTexture(game: Game, tileTexture: TileTexture): number {
    let count = 0;
    game.grid.forEach((row) => (count += row.filter((tile) => tile.type === tileTexture).length));

    return count;
  }

  countTileItem(game: Game, tileItem: TileItem): number {
    let count = 0;
    game.grid.forEach((row) => (count += row.filter((tile) => tile.item === tileItem).length));

    return count;
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
      case TileItem.HealingSanctuary:
        return counts.healingSanctuaryCount > 0;
      case TileItem.CombatSanctuary:
        return counts.combatSanctuaryCount > 0;
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
      case TileItem.HealingSanctuary:
        counts.healingSanctuaryCount--;
        break;
      case TileItem.CombatSanctuary:
        counts.combatSanctuaryCount--;
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
      case TileItem.HealingSanctuary:
        counts.healingSanctuaryCount++;
        break;
      case TileItem.CombatSanctuary:
        counts.combatSanctuaryCount++;
        break;
      case TileItem.Flag:
        counts.flagCount++;
        break;
    }
  }

  applyTile(
    game: Game,
    rowIndex: number,
    colIndex: number,
    tileAttribute: TileItem | TileTexture,
    counts: TileItemCounts
  ): void {
    const currentTile = game.grid[rowIndex]?.[colIndex];

    if (Object.values(TileItem).includes(tileAttribute as TileItem)) {
      if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(currentTile.type)) {
        throw new Error('This Item cannot be place on a terrain tile');
      }
      if (!currentTile.item && this.verifyEnoughTileItem(counts, tileAttribute as TileItem)) {
        currentTile.item = tileAttribute as TileItem;
        this.decreaseTileItemCount(counts, tileAttribute as TileItem);
      }
    } else {
      if (currentTile.type !== tileAttribute) {
        currentTile.type = tileAttribute as TileTexture;
      }
    }
  }

  deleteTile(
    game: Game,
    rowIndex: number,
    colIndex: number,
    tileAttribute: TileItem | TileTexture,
    event: MouseEvent,
    counts: TileItemCounts
  ): void {
    const currentTile = game.grid[rowIndex]?.[colIndex];
    const currItem = currentTile.item;

    if (currItem && Object.values(TileItem).includes(tileAttribute as TileItem) && event.shiftKey) {
      currentTile.item = null;
      this.increaseTileItemCount(counts, currItem);
    } else {
      currentTile.type = TileTexture.Floor;
    }
  }

  removeBlockingItemIfNeeded(gameTile: Tile, activeTileTexture: TileTexture, counts: TileItemCounts): void {
    if (
      [TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(activeTileTexture) &&
      gameTile.item
    ) {
      const removedItem = gameTile.item;
      gameTile.item = null;
      this.increaseTileItemCount(counts, removedItem);
    }
  }

  getObjectAt(game: Game, x: number, y: number): Tile | undefined {
    return game.grid[x]?.[y];
  }

  selectTileTexture(
    activeTileTexture: TileTexture | null,
    activeTileItem: TileItem | null,
    type: TileTexture
  ): MapSetupSelection {
    const nextActiveTileTexture = activeTileTexture === type ? null : type;
    const nextActiveTileItem = nextActiveTileTexture != null ? null : activeTileItem;
    return { activeTileTexture: nextActiveTileTexture, activeTileItem: nextActiveTileItem };
  }

  selectTileItem(
    activeTileItem: TileItem | null,
    activeTileTexture: TileTexture | null,
    type: TileItem
  ): MapSetupSelection {
    const nextActiveTileItem = activeTileItem === type ? null : type;
    const nextActiveTileTexture = nextActiveTileItem != null ? null : activeTileTexture;
    return { activeTileTexture: nextActiveTileTexture, activeTileItem: nextActiveTileItem };
  }

  applyActiveSelection(
    game: Game,
    rowIndex: number,
    colIndex: number,
    activeTileTexture: TileTexture | null,
    activeTileItem: TileItem | null,
    counts: TileItemCounts
  ): void {
    //  if tile texture is not null, apply tile texture
    if (activeTileTexture) {
      this.applyTile(game, rowIndex, colIndex, activeTileTexture, counts);
    } // if tile item is not null, apply tile texture
    else if (activeTileItem) {
      this.applyTile(game, rowIndex, colIndex, activeTileItem, counts);
    } else {
      return;
    }
  }

  handleCellMouseDown(params: {
    game: Game;
    rowIndex: number;
    colIndex: number;
    event: MouseEvent;
    activeTileTexture: TileTexture | null;
    activeTileItem: TileItem | null;
    counts: TileItemCounts;
    isPaintingTiles: boolean;
    isErasingTiles: boolean;
  }): MapSetupInteractionState {
    const {
      game,
      rowIndex,
      colIndex,
      event,
      activeTileTexture,
      activeTileItem,
      counts,
      isPaintingTiles,
      isErasingTiles,
    } = params;

    if (event.button === MOUSE_EVENT.LeftClick) {
      if (activeTileTexture) {
        this.applyTile(game, rowIndex, colIndex, activeTileTexture, counts);
      } else if (activeTileItem) {
        this.applyTile(game, rowIndex, colIndex, activeTileItem, counts);
      }
      return { isPaintingTiles: true, isErasingTiles };
    }

    if (event.button === MOUSE_EVENT.RightClick) {
      event.preventDefault();
      if (activeTileTexture) {
        this.deleteTile(game, rowIndex, colIndex, activeTileTexture, event, counts);
      } else if (activeTileItem) {
        this.deleteTile(game, rowIndex, colIndex, activeTileItem, event, counts);
      }
      return { isPaintingTiles, isErasingTiles: true };
    }

    return { isPaintingTiles, isErasingTiles };
  }

  handleCellMouseEnter(params: {
    game: Game;
    rowIndex: number;
    colIndex: number;
    event: MouseEvent;
    activeTileTexture: TileTexture | null;
    activeTileItem: TileItem | null;
    counts: TileItemCounts;
    isPaintingTiles: boolean;
    isErasingTiles: boolean;
  }): MapSetupInteractionState {
    const {
      game,
      rowIndex,
      colIndex,
      event,
      activeTileTexture,
      activeTileItem,
      counts,
      isPaintingTiles,
      isErasingTiles,
    } = params;

    if (isErasingTiles) {
      if (event.buttons !== MOUSE_EVENT.RightDrag) {
        return { isPaintingTiles, isErasingTiles: false };
      }

      if (event.shiftKey && activeTileItem) {
        this.deleteTile(game, rowIndex, colIndex, activeTileItem, event, counts);
      } else if (activeTileTexture) {
        this.deleteTile(game, rowIndex, colIndex, activeTileTexture, event, counts);
      }
      return { isPaintingTiles, isErasingTiles };
    }

    if (!isPaintingTiles) return { isPaintingTiles, isErasingTiles };

    if (event.buttons !== MOUSE_EVENT.LeftDrag) {
      return { isPaintingTiles: false, isErasingTiles };
    }

    const gameTile = game.grid[rowIndex][colIndex];
    if (activeTileTexture) {
      this.removeBlockingItemIfNeeded(gameTile, activeTileTexture, counts);
      this.applyTile(game, rowIndex, colIndex, activeTileTexture, counts);
    }

    return { isPaintingTiles, isErasingTiles };
  }

  resetInteractionState(): MapSetupInteractionState {
    return { isPaintingTiles: false, isErasingTiles: false };
  }

  resetSelection(): MapSetupSelection {
    return { activeTileTexture: null, activeTileItem: null };
  }

  resetGrid(game: Game): void {
    game.grid.forEach((row) => {
      row.forEach((tile) => {
        tile.type = TileTexture.Floor;
        tile.item = null;
      });
    });
  }

  resetMap(game: Game): MapSetupResetResult {
    this.resetGrid(game);
    return {
      itemCounts: this.createRequiredCounts(game),
      selection: this.resetSelection(),
    };
  }

  extractGridTypes(game: Game): TileTexture[][] {
    return game.grid.map((row) => row.map((tile) => tile.type));
  }

  extractPlacedObjects(game: Game): PlacedObject[] {
    const placedObjects = [] as PlacedObject[];
    for (let row = 0; row < game.grid.length; row++) {
      for (let col = 0; col < game.grid[row].length; col++) {
        const tile = game.grid[row][col];
        if (tile.item) {
          placedObjects.push({
            type: tile.item,
            position: { x: col, y: row },
          });
        }
      }
    }

    return placedObjects;
  }

  buildValidationPayload(game: Game): GameDraftForValidation {
    return {
      name: game.name,
      description: game.description,
      mode: game.gameMode,
      size: game.size,
      grid: this.extractGridTypes(game),
      placedObjects: this.extractPlacedObjects(game),
    };
  }
}
