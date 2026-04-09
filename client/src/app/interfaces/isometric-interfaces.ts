import { Vec2 } from '@common/vec2';
import { Tile } from '@common/tile';
import { Player } from '@common/player';

// Moved here from isometric.constants.ts so it can be shared across service methods
export interface TileColorSet {
  top: string;
  left: string;
  right: string;
}

export interface GridCorners {
  topLeft: Vec2;
  topRight: Vec2;
  bottomLeft: Vec2;
  bottomRight: Vec2;
}

// Slimmed down: only the 4 vertices, tile, and ctx. Wall/grid-position info is handled separately.
export interface TileRenderParams {
  context: CanvasRenderingContext2D;
  tile: Tile;
  surfaceTopLeft: Vec2;
  surfaceTopRight: Vec2;
  surfaceBottomLeft: Vec2;
  surfaceBottomRight: Vec2;
}

// Separate, minimal interface for wall-drop rendering (only what drawTileDepth actually needs)
export interface TileDepthParams {
  context: CanvasRenderingContext2D;
  thickness: number;
  rowIndex: number;
  totalRows: number;
  columnIndex: number;
  totalColumns: number;
  surfaceTopRight: Vec2;
  surfaceBottomRight: Vec2;
  surfaceBottomLeft: Vec2;
}

export interface RenderBoardConfig {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  grid: Tile[][];
  players: Player[];
  playerPositions: Record<string, Vec2>;
  camera: { x: number; y: number; zoom: number };
  needsRecenter: boolean;
  onRecenter: (zoom: number, x: number, y: number) => void;
  reachableTiles?: Vec2[];
  teleportableTiles?: Vec2[];
  localPlayerSocketId?: string;
  inactiveSanctuaries?: Vec2[];
}
