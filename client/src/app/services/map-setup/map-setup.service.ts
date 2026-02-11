import { Injectable } from '@angular/core';
import { type PlacedObject, Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { MouseEventType } from '@app/pages/map-setup-page/map-setup-page-constant';
import type { GameDraftForValidation } from '@app/services/game-validator/game-validator.service';
import {
  MapSetupInteractionState,
  MapSetupResetResult,
  MapSetupSelection,
  TileItemCounts,
  TileParams,
} from '@app/services/map-setup.types';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { TileItem, TileTexture } from '@common/enums';

@Injectable({ providedIn: 'root' })
export class MapSetupService {
  constructor(private readonly tileItemCountService: TileItemCountService) {}

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
        })),
      );
    }
  }

  applyTile(params: TileParams): void {
    const { game, rowIndex, colIndex, tileAttribute, event, counts } = params;
    const currentTile = game.grid[rowIndex]?.[colIndex];

    if (Object.values(TileItem).includes(tileAttribute as TileItem)) {
      if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(currentTile.type)) {
        throw new Error('This Item cannot be place on a terrain tile');
      }
      if (
        !currentTile.item &&
        this.tileItemCountService.verifyEnoughTileItem(counts, tileAttribute as TileItem)
      ) {
        currentTile.item = tileAttribute as TileItem;
        this.tileItemCountService.decreaseTileItemCount(counts, tileAttribute as TileItem);
      }
    } else {
      // Prevent placing non-walkable textures on cells with items
      if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(tileAttribute as TileTexture) && currentTile.item) {
        this.deleteTile({ game, rowIndex, colIndex, tileAttribute, event, counts });
      }
      if (currentTile.type !== tileAttribute) {
        currentTile.type = tileAttribute as TileTexture;
      }
    }
  }

  deleteTile(params: TileParams): void {
    const { game, rowIndex, colIndex, tileAttribute, event, counts } = params;
    const currentTile = game.grid[rowIndex]?.[colIndex];
    const currItem = currentTile.item;

    // If shift key is pressed delete the item
    if (currItem && event.shiftKey) {
      currentTile.item = null;
      this.tileItemCountService.increaseTileItemCount(counts, currItem);
    } else if (Object.values(TileTexture).includes(tileAttribute as TileTexture)) {
      this.tileItemCountService.increaseTileItemCount(counts, currentTile.item as TileItem);
      currentTile.item = null;
    } else if (Object.values(TileItem).includes(tileAttribute as TileItem)) {
      return;
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
      this.tileItemCountService.increaseTileItemCount(counts, removedItem);
    }
  }

  getObjectAt(game: Game, x: number, y: number): Tile | undefined {
    return game.grid[x]?.[y];
  }

  selectTileTexture(
    activeTileTexture: TileTexture | null,
    activeTileItem: TileItem | null,
    type: TileTexture,
  ): MapSetupSelection {
    const nextActiveTileTexture = activeTileTexture === type ? null : type;
    const nextActiveTileItem = nextActiveTileTexture != null ? null : activeTileItem;
    return { activeTileTexture: nextActiveTileTexture, activeTileItem: nextActiveTileItem };
  }

  selectTileItem(
    activeTileItem: TileItem | null,
    activeTileTexture: TileTexture | null,
    type: TileItem,
  ): MapSetupSelection {
    const nextActiveTileItem = activeTileItem === type ? null : type;
    const nextActiveTileTexture = nextActiveTileItem != null ? null : activeTileTexture;
    return { activeTileTexture: nextActiveTileTexture, activeTileItem: nextActiveTileItem };
  }

  applyActiveSelection(params: TileParams): void {
    const { game, rowIndex, colIndex, tileAttribute, event, counts } = params;

    if (tileAttribute) {
      this.applyTile({ game, rowIndex, colIndex, tileAttribute, event, counts });
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

    if (event.button === MouseEventType.LeftClick) {
      // Only set isPaintingTiles to true if we have something selected to paint
      if (activeTileTexture) {
        const tileAttribute = activeTileTexture;
        try {
          this.applyTile({ game, rowIndex, colIndex, tileAttribute, event, counts });
          return { isPaintingTiles: true, isErasingTiles };
        } catch {
          return { isPaintingTiles: false, isErasingTiles };
        }
      } else if (activeTileItem) {
        const tileAttribute = activeTileItem;
        this.applyTile({ game, rowIndex, colIndex, tileAttribute, event, counts });
        return { isPaintingTiles: true, isErasingTiles };
      }
      return { isPaintingTiles: false, isErasingTiles };
    }

    if (event.button === MouseEventType.RightClick) {
      event.preventDefault();
      if (activeTileTexture) {
        this.deleteTile({
          game,
          rowIndex,
          colIndex,
          tileAttribute: activeTileTexture,
          event,
          counts,
        });
      } else if (activeTileItem) {
        this.deleteTile({
          game,
          rowIndex,
          colIndex,
          tileAttribute: activeTileItem,
          event,
          counts,
        });
      } else {
        const tile = game.grid[rowIndex][colIndex];
        if (event.shiftKey && tile.item) {
          this.deleteTile({
            game,
            rowIndex,
            colIndex,
            tileAttribute: tile.item,
            event,
            counts,
          });
        } else if (!event.shiftKey) {
          if (tile.type !== TileTexture.Floor) {
            this.deleteTile({
              game,
              rowIndex,
              colIndex,
              tileAttribute: TileTexture.Floor,
              event,
              counts,
            });
          } else if (tile.item) {
            this.deleteTile({
              game,
              rowIndex,
              colIndex,
              tileAttribute: tile.item,
              event,
              counts,
            });
          }
        }
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
    let gameTile = game.grid[rowIndex][colIndex];

    if (isErasingTiles) {
      if (event.buttons !== MouseEventType.RightDrag) {
        return { isPaintingTiles, isErasingTiles: false };
      }

      // When right-dragging (erasing), handle deletion
      try {
        if (event.shiftKey) {
          // With shift, delete items if present
          const tile = game.grid[rowIndex][colIndex];
          if (tile.item) {
            this.deleteTile({
              game,
              rowIndex,
              colIndex,
              tileAttribute: tile.item,
              event,
              counts,
            });
          }
        } else {
          // Without shift, delete texture by calling deleteTile
          this.deleteTile({
            game,
            rowIndex,
            colIndex,
            tileAttribute: TileTexture.Floor,
            event,
            counts,
          });
        }
      } catch {
        throw new Error(`Error while handeling cell mouse enter`);
      }
      return { isPaintingTiles, isErasingTiles };
    }

    if (!isPaintingTiles) return { isPaintingTiles, isErasingTiles };

    if (event.buttons !== MouseEventType.LeftDrag) {
      return { isPaintingTiles: false, isErasingTiles };
    }

    gameTile = game.grid[rowIndex][colIndex];
    if (activeTileTexture) {
      // Remove items before applying a texture that blocks walking
      this.removeBlockingItemIfNeeded(gameTile, activeTileTexture, counts);
      const tileAttribute = activeTileTexture;
      try {
        this.applyTile({ game, rowIndex, colIndex, tileAttribute, event, counts });
      } catch {
        throw new Error(`Error while handeling cell mouse enter`);
      }
    } else if (activeTileItem) {
      const tileAttribute = activeTileItem;
      try {
        this.applyTile({ game, rowIndex, colIndex, tileAttribute, event, counts });
      } catch {
        throw new Error(`Error while handeling cell mouse enter`);
      }
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
      itemCounts: this.tileItemCountService.createRequiredCounts(game),
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
