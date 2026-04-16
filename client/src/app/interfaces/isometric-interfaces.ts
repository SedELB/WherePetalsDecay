import { PlayerAction } from '@common/enums';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

export type ActionHighlightType = PlayerAction;

export interface ActionTileHighlight {
  pos: Vec2;
  type: ActionHighlightType;
}

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

export interface TileRenderParams {
  context: CanvasRenderingContext2D;
  tile: Tile;
  surfaceTopLeft: Vec2;
  surfaceTopRight: Vec2;
  surfaceBottomLeft: Vec2;
  surfaceBottomRight: Vec2;
}

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

export interface TileDimensions {
  tileW: number;
  tileH: number;
}

export interface IsoViewConfig {
  originX: number;
  originY: number;
  tileW: number;
  tileH: number;
}

export interface PlayerShadowData {
  cx: number;
  cy: number;
  tileH: number;
  imgW: number;
  imgH: number;
}

export interface TileItemRenderData {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  tileW: number;
  tileH: number;
}

export interface RenderBoardConfig {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  grid: Tile[][];
  players: Player[];
  playerPositions: Record<string, Vec2>;
  playerStartPositions?: Record<string, Vec2>;
  camera: { x: number; y: number; zoom: number };
  needsRecenter: boolean;
  onRecenter: (zoom: number, x: number, y: number) => void;
  reachableTiles?: Vec2[];
  teleportableTiles?: Vec2[];
  actionHighlightTiles?: ActionTileHighlight[];
  localPlayerSocketId?: string;
  isLocalPlayerTurn?: boolean;
  inactiveSanctuaries?: Vec2[];
  isCTF?: boolean;
  teamA?: Player[];
  teamB?: Player[];
  showDirectionalKeys?: boolean;
  pressedDirectionKey?: 'W' | 'A' | 'S' | 'D' | null;
  flipXMap?: Record<string, boolean>;
}
