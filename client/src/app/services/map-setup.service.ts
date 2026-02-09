import { Injectable } from '@angular/core';
import { type PlacedObject, Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { MouseEventType } from '@app/pages/map-setup-page/map-setup-page-constant';
import type { GameDraftForValidation } from '@app/services/game-validator.service';
import {
  ApplyActiveSelectionParams,
  DeleteTileParams,
  MapSetupInteractionState,
  MapSetupResetResult,
  MapSetupSelection,
  TileItemCounts,
} from '@app/services/map-setup.types';
import { TileItemCountService } from '@app/services/tile-item-count.service';
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

  applyTile(
    game: Game,
    rowIndex: number,
    colIndex: number,
    tileAttribute: TileItem | TileTexture,
    counts: TileItemCounts,
  ): void {
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
      if (currentTile.type !== tileAttribute) {
        currentTile.type = tileAttribute as TileTexture;
      }
    }
  }

  deleteTile(params: DeleteTileParams): void {
    const { game, rowIndex, colIndex, tileAttribute, event, counts } = params;
    const currentTile = game.grid[rowIndex]?.[colIndex];
    const currItem = currentTile.item;

    if (currItem && Object.values(TileItem).includes(tileAttribute as TileItem) && event.shiftKey) {
      currentTile.item = null;
      this.tileItemCountService.increaseTileItemCount(counts, currItem);
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

  applyActiveSelection(params: ApplyActiveSelectionParams): void {
    const { game, rowIndex, colIndex, activeTileTexture, activeTileItem, counts } = params;

    if (activeTileTexture) {
      this.applyTile(game, rowIndex, colIndex, activeTileTexture, counts);
    } else if (activeTileItem) {
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

    if (event.button === MouseEventType.LeftClick) {
      if (activeTileTexture) {
        this.applyTile(game, rowIndex, colIndex, activeTileTexture, counts);
      } else if (activeTileItem) {
        this.applyTile(game, rowIndex, colIndex, activeTileItem, counts);
      }
      return { isPaintingTiles: true, isErasingTiles };
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
      if (event.buttons !== MouseEventType.RightDrag) {
        return { isPaintingTiles, isErasingTiles: false };
      }

      if (event.shiftKey && activeTileItem) {
        this.deleteTile({
          game,
          rowIndex,
          colIndex,
          tileAttribute: activeTileItem,
          event,
          counts,
        });
      } else if (activeTileTexture) {
        this.deleteTile({
          game,
          rowIndex,
          colIndex,
          tileAttribute: activeTileTexture,
          event,
          counts,
        });
      }
      return { isPaintingTiles, isErasingTiles };
    }

    if (!isPaintingTiles) return { isPaintingTiles, isErasingTiles };

    if (event.buttons !== MouseEventType.LeftDrag) {
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
