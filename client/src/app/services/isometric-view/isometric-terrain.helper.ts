import { Vec2 } from '@common/vec2';
import { TileRenderParams, RenderBoardConfig, TileColorSet, TileDepthParams } from '@app/interfaces/isometric-interfaces';
import { Tile } from '@common/tile';
import { TileTexture } from '@common/enums';
import { getPortcullisCanvas } from './portcullis-tile';
import { ISO_TEXTURE_ASSETS, TILE_COLORS, DEFAULT_COLOR, RENDER_CONSTANTS } from '@app/constants/isometric.constants';

function buildPolygonPath(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

export function drawTileDepth(params: TileDepthParams, colors: TileColorSet): void {
  const { context: ctx, rowIndex, columnIndex, totalRows, totalColumns, thickness,
    surfaceBottomLeft: west, surfaceBottomRight: south, surfaceTopRight: east } = params;
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
  const { north, east, west } = corners;
  if (tile.type === TileTexture.DoorOpened || tile.type === TileTexture.DoorClosed) {
    const offscreen = getPortcullisCanvas();
    const piw = offscreen.width;
    const pih = offscreen.height;

    ctx.save();
    ctx.clip();
    ctx.transform(
      (east.x - north.x) / piw, (east.y - north.y) / piw,
      (west.x - north.x) / pih, (west.y - north.y) / pih,
      north.x, north.y,
    );
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
    return;
  }

  const imageSrc = ISO_TEXTURE_ASSETS[tile.type];
  if (!imageSrc) return;

  const tileImg = getImage(imageSrc);
  if (!tileImg?.complete || tileImg.naturalWidth <= 0) return;

  ctx.save();
  ctx.clip();
  const iw = tileImg.naturalWidth;
  const ih = tileImg.naturalHeight;

  ctx.transform(
    (east.x - north.x) / iw, (east.y - north.y) / iw,
    (west.x - north.x) / ih, (west.y - north.y) / ih,
    north.x, north.y,
  );

  ctx.drawImage(tileImg, 0, 0);
  ctx.restore();
}

export function drawIsometricTileBase(params: TileRenderParams, depthParams: TileDepthParams, config: RenderBoardConfig,
  getImage: (src: string) => HTMLImageElement | null): void {

  const { context: ctx, tile, surfaceTopLeft: north, surfaceTopRight: east,
    surfaceBottomRight: south, surfaceBottomLeft: west } = params;

  const colors = TILE_COLORS[tile.type] || DEFAULT_COLOR;
  buildPolygonPath(ctx, [north, east, south, west]);
  ctx.fillStyle = colors.top;
  ctx.fill();

  drawTileTexture(ctx, tile, { north, east, west }, getImage);

  const col = depthParams.columnIndex;
  const row = depthParams.rowIndex;
  const isReachable = config.reachableTiles?.some((t) => t.x === col && t.y === row);
  const isTeleportable = config.teleportableTiles?.some((t) => t.x === col && t.y === row);

  if (isReachable || isTeleportable) {
    ctx.save();
    buildPolygonPath(ctx, [north, east, south, west]);
    ctx.fillStyle = isTeleportable ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    ctx.restore();
  }

  const actionHighlight = config.actionHighlightTiles?.find(h => h.pos.x === col && h.pos.y === row);
  if (actionHighlight) {
    const pulse = RENDER_CONSTANTS.actionPulseBase +
      RENDER_CONSTANTS.actionPulseAmplitude * Math.sin(Date.now() / RENDER_CONSTANTS.actionPulseSpeed);
    const ACTION_COLORS: Record<string, string> = {
      attack:       `rgba(255, 60, 60, ${pulse})`,
      giveFlag:     `rgba(50, 255, 110, ${pulse})`,
      requestFlag:  `rgba(80, 180, 255, ${pulse})`,
    };
    ctx.save();
    buildPolygonPath(ctx, [north, east, south, west]);
    ctx.fillStyle = ACTION_COLORS[actionHighlight.type] ?? `rgba(255,255,255,${pulse})`;
    ctx.fill();
    
    const GLOW_COLORS: Record<string, string> = {
      attack:       'rgba(255, 60, 60, 0.9)',
      giveFlag:     'rgba(50, 255, 110, 0.9)',
      requestFlag:  'rgba(80, 180, 255, 0.9)',
    };
    ctx.strokeStyle = GLOW_COLORS[actionHighlight.type] ?? 'rgba(255,255,255,0.9)';
    ctx.lineWidth = RENDER_CONSTANTS.actionGlowLineWidth;
    ctx.stroke();
    ctx.restore();
  }

  ctx.stroke();
  drawTileDepth(depthParams, colors);
}
