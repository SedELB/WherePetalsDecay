import { Vec2 } from '@common/vec2';
import { TileRenderParams, RenderBoardConfig, TileColorSet, TileDepthParams } from '@app/interfaces/isometric-interfaces';
import { Tile } from '@common/tile';
import { TileTexture } from '@common/enums';
import { getPortcullisCanvas } from './portcullis-tile';
import { ISO_TEXTURE_ASSETS, TILE_COLORS, DEFAULT_COLOR, RENDER_CONSTANTS } from '@app/constants/isometric.constants';

const OVERLAY_REACHABLE = 'rgba(255, 255, 255, 0.4)';
const OVERLAY_TELEPORTABLE = 'rgba(0, 255, 255, 0.5)';
const OVERLAY_FALLBACK = 'rgba(255,255,255,0.9)';

const ACTION_GLOW_COLORS: Record<string, string> = {
  attack: 'rgba(255, 60, 60, 0.9)',
  giveFlag: 'rgba(50, 255, 110, 0.9)',
  requestFlag: 'rgba(80, 180, 255, 0.9)',
  toggleDoor: 'rgba(243, 156, 18, 0.9)',
};

function buildPolygonPath(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function isDoorTile(tile: Tile): boolean {
  return tile.type === TileTexture.DoorOpened || tile.type === TileTexture.DoorClosed;
}

function isSameCell(pos: Vec2, col: number, row: number): boolean {
  return pos.x === col && pos.y === row;
}

function drawProjectedImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  corners: { north: Vec2; east: Vec2; west: Vec2 },
): void {
  const { north, east, west } = corners;

  ctx.save();
  ctx.clip();
  ctx.transform(
    (east.x - north.x) / sourceWidth, (east.y - north.y) / sourceWidth,
    (west.x - north.x) / sourceHeight, (west.y - north.y) / sourceHeight,
    north.x, north.y,
  );
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

function drawTopFace(ctx: CanvasRenderingContext2D, diamond: Vec2[], topColor: string): void {
  buildPolygonPath(ctx, diamond);
  ctx.fillStyle = topColor;
  ctx.fill();
}

function drawMovementOverlay(
  ctx: CanvasRenderingContext2D,
  diamond: Vec2[],
  isReachable: boolean,
  isTeleportable: boolean,
): void {
  if (!isReachable && !isTeleportable) return;

  ctx.save();
  buildPolygonPath(ctx, diamond);
  ctx.fillStyle = isTeleportable ? OVERLAY_TELEPORTABLE : OVERLAY_REACHABLE;
  ctx.fill();
  ctx.restore();
}

function getActionFillColor(type: string, pulse: number): string {
  const ACTION_FILL_COLORS: Record<string, string> = {
    attack: `rgba(255, 60, 60, ${pulse})`,
    giveFlag: `rgba(50, 255, 110, ${pulse})`,
    requestFlag: `rgba(80, 180, 255, ${pulse})`,
    toggleDoor: `rgba(243, 156, 18, ${pulse})`,
  };
  return ACTION_FILL_COLORS[type] ?? `rgba(255,255,255,${pulse})`;
}

// Pulsing effect when action is available
function drawActionOverlay(ctx: CanvasRenderingContext2D, diamond: Vec2[], actionType: string): void {
  const pulse =
    RENDER_CONSTANTS.actionPulseBase +
    RENDER_CONSTANTS.actionPulseAmplitude * Math.sin(Date.now() / RENDER_CONSTANTS.actionPulseSpeed);

  ctx.save();
  buildPolygonPath(ctx, diamond);
  ctx.fillStyle = getActionFillColor(actionType, pulse);
  ctx.fill();
  ctx.strokeStyle = ACTION_GLOW_COLORS[actionType] ?? OVERLAY_FALLBACK;
  ctx.lineWidth = RENDER_CONSTANTS.actionGlowLineWidth;
  ctx.stroke();
  ctx.restore();
}

// Tile thickness for front tiles (left and right)
export function drawTileDepth(params: TileDepthParams, colors: TileColorSet): void {
  const {
    context: ctx,
    rowIndex,
    columnIndex,
    totalRows,
    totalColumns,
    thickness,
    surfaceBottomLeft: west,
    surfaceBottomRight: south,
    surfaceTopRight: east,
  } = params;

  const baseEast = { x: east.x, y: east.y + thickness };
  const baseSouth = { x: south.x, y: south.y + thickness };
  const baseWest = { x: west.x, y: west.y + thickness };

  if (rowIndex === totalRows - 1) {
    buildPolygonPath(ctx, [west, south, baseSouth, baseWest]);
    ctx.fillStyle = colors.left;
    ctx.fill();
    ctx.stroke();
  }

  if (columnIndex === totalColumns - 1) {
    buildPolygonPath(ctx, [south, east, baseEast, baseSouth]);
    ctx.fillStyle = colors.right;
    ctx.fill();
    ctx.stroke();
  }
}

export function drawTileTexture(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  corners: { north: Vec2; east: Vec2; west: Vec2 },
  getImage: (src: string) => HTMLImageElement | null,
): void {
  if (isDoorTile(tile)) {
    const offscreen = getPortcullisCanvas();
    drawProjectedImage(ctx, offscreen, offscreen.width, offscreen.height, corners);
    return;
  }

  const imageSrc = ISO_TEXTURE_ASSETS[tile.type];
  if (!imageSrc) return;

  const tileImg = getImage(imageSrc);
  if (!tileImg?.complete || tileImg.naturalWidth <= 0) return;

  drawProjectedImage(ctx, tileImg, tileImg.naturalWidth, tileImg.naturalHeight, corners);
}

export function drawIsometricTileBase(
  params: TileRenderParams,
  depthParams: TileDepthParams,
  config: RenderBoardConfig,
  getImage: (src: string) => HTMLImageElement | null,
): void {
  const {
    context: ctx,
    tile,
    surfaceTopLeft: north,
    surfaceTopRight: east,
    surfaceBottomRight: south,
    surfaceBottomLeft: west,
  } = params;

  const diamond = [north, east, south, west];
  const colors = TILE_COLORS[tile.type] || DEFAULT_COLOR;
  const col = depthParams.columnIndex;
  const row = depthParams.rowIndex;

  drawTopFace(ctx, diamond, colors.top);
  drawTileTexture(ctx, tile, { north, east, west }, getImage);

  const isReachable = config.reachableTiles?.some((t) => isSameCell(t, col, row)) ?? false;
  const isTeleportable = config.teleportableTiles?.some((t) => isSameCell(t, col, row)) ?? false;
  drawMovementOverlay(ctx, diamond, isReachable, isTeleportable);

  const actionHighlight = config.actionHighlightTiles?.find((h) => isSameCell(h.pos, col, row));
  if (actionHighlight) drawActionOverlay(ctx, diamond, actionHighlight.type);

  ctx.stroke();
  drawTileDepth(depthParams, colors);
}