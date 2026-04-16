import { TileColorSet } from '@app/interfaces/isometric-interfaces';
import { TileItem, TileTexture } from '@common/enums';


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

export const RENDER_CONSTANTS = {
  itemFloatSpeed: 350,
  itemFloatAmplitude: 0.10,
  itemFloatBaseOffset: 0.4,
  itemWidthRatio: 0.5,
  itemVerticalOffset: -0.25,

  itemShadowRadiusXRatio: 0.2,
  itemShadowRadiusYRatio: 0.08,
  itemShadowOffsetYRatio: 0.35,
  itemShadowScaleMin: 0.65,
  itemShadowScaleRange: 0.35,
  itemShadowAlphaMin: 0.12,
  itemShadowAlphaRange: 0.22,

  playerWidthRatio: 0.75,
  playerHeightAdjustment: 0.9,
  playerDepthOffset: 0.1,

  shadowOffsetYRatio: 0.05,
  shadowRadiusXRatio: 0.4,
  shadowRadiusYRatio: 0.1,

  actionPulseBase: 0.38,
  actionPulseAmplitude: 0.22,
  actionPulseSpeed: 300,
  actionGlowLineWidth: 2.5,
  oneSecondMs: 1000,
};


export const TILE_COLORS: Record<string, TileColorSet> = {
  [TileTexture.Floor]: { top: '#6C6C6C', left: '#6C6C6C', right: '#6C6C6C' },
  [TileTexture.Water]: { top: '#46A8CF', left: '#46A8CF', right: '#46A8CF' },
  [TileTexture.Ice]: { top: '#BEE2F3', left: '#BEE2F3', right: '#BEE2F3' },
  [TileTexture.Wall]: { top: '#8C897F', left: '#8C897F', right: '#8C897F' },
  [TileTexture.DoorClosed]: { top: '#d35400', left: '#ba4a00', right: '#a04000' },
  [TileTexture.DoorOpened]: { top: '#f39c12', left: '#d68910', right: '#b9770e' },
};

export const ISO_ITEM_ASSETS: Partial<Record<TileItem, string>> = {
  [TileItem.Spawn]: './assets/icons/spawnPoint.svg',
  [TileItem.Flag]: './assets/icons/japFlagStick.svg',
};

export const ISO_TEXTURE_ASSETS: Record<TileTexture, string> = {
  [TileTexture.Floor]: './assets/tiles/default3.png',
  [TileTexture.Water]: './assets/tiles/water.png',
  [TileTexture.Ice]: './assets/tiles/ice.png',
  [TileTexture.Wall]: './assets/tiles/wall.jpg',
  [TileTexture.DoorClosed]: '',
  [TileTexture.DoorOpened]: '',
};

export const DEFAULT_COLOR: TileColorSet = {
  top: '#83a0b5',
  left: '#657e8c',
  right: '#506573',
};
