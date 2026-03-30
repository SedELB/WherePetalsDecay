import { TileTexture } from '@common/enums';
import { TileColorSet } from '@app/interfaces/isometric-interfaces';


export const TILE_RATIO = 2.5;
export const TILE_THICKNESS = 12;
export const TILE_LINE_WIDTH = 1;
export const MIN_TILE_W = 64;

// Zoom limits
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3.0;
export const ZOOM_SPEED = 0.001;

export const STROKE_COLOR = 'rgba(0, 0, 0, 0.3)';

// Rendering Ratios and Offsets
export const AUTO_ZOOM_FALLBACK = 0.8;
export const NAV_KEY_MARGIN = 2.0;
export const NAV_KEY_OFFSET_EXTRA = 0.5;

export const RENDER_CONSTANTS = {
  itemFloatSpeed: 350,
  itemFloatAmplitude: 0.10,
  itemFloatBaseOffset: 0.4,
  itemWidthRatio: 0.5,
  
  playerWidthRatio: 0.75,
  playerHeightAdjustment: 0.9,
  playerDepthOffset: 0.1,
};


export const TILE_COLORS: Record<string, TileColorSet> = {
  [TileTexture.Floor]: { top: '#0d9614ff', left: '#6eb853', right: '#52963a' }, // Green
  [TileTexture.Water]: { top: '#5dade2', left: '#3498db', right: '#2e86c1' }, // Blue
  [TileTexture.Ice]: { top: '#e0f7fa', left: '#b2ebf2', right: '#80deea' },   // White
  [TileTexture.Wall]: { top: '#407070ff', left: '#538f8fff', right: '#101313ff' },  // Gray
  [TileTexture.DoorClosed]: { top: '#d35400', left: '#ba4a00', right: '#a04000' }, // Wood
  [TileTexture.DoorOpened]: { top: '#f39c12', left: '#d68910', right: '#b9770e' }, // Open wood
};

export const DEFAULT_COLOR: TileColorSet = {
  top: '#83a0b5',
  left: '#657e8c',
  right: '#506573',
};
