import { TileItem, TileTexture } from '@common/enums';
import { Game } from '@common/game';

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

export interface TileParams {
  game: Game;
  rowIndex: number;
  colIndex: number;
  tileAttribute: TileItem | TileTexture;
  event: MouseEvent;
  counts: TileItemCounts;
}