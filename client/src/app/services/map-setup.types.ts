import { Game } from '@app/interfaces/game';
import { TileItem, TileTexture } from '@common/enums';

export interface TileItemCounts {
  spawnCount: number;
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

export interface ApplyActiveSelectionParams {
  game: Game;
  rowIndex: number;
  colIndex: number;
  activeTileTexture: TileTexture | null;
  activeTileItem: TileItem | null;
  counts: TileItemCounts;
}

export interface DeleteTileParams {
  game: Game;
  rowIndex: number;
  colIndex: number;
  tileAttribute: TileItem | TileTexture;
  event: MouseEvent;
  counts: TileItemCounts;
}
