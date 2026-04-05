import { Vec2 } from '@common/vec2';
import { RenderBoardConfig } from '@app/interfaces/isometric-interfaces';
import { MIN_TILE_W, TILE_RATIO, TILE_THICKNESS, AUTO_ZOOM_FALLBACK } from '@app/constants/isometric.constants';

export function calculateAutoZoom(totalRows: number, totalColumns: number, config: RenderBoardConfig): { tileW: number, tileH: number } {
  const fitTileW = (2 * config.width) / (totalColumns + totalRows);
  const tileW = Math.max(fitTileW, MIN_TILE_W);
  const tileH = tileW / TILE_RATIO;

  if (config.needsRecenter) {
    config.camera.zoom = fitTileW >= MIN_TILE_W ? 1 : fitTileW / MIN_TILE_W;
    config.camera.zoom = Math.max(config.camera.zoom, AUTO_ZOOM_FALLBACK);
    config.camera.x = 0;
    config.camera.y = 0;
    config.onRecenter(config.camera.zoom, config.camera.x, config.camera.y);
  }
  return { tileW, tileH };
}

export function buildViewConfig(totalRows: number, totalColumns: number, tileW: number, tileH: number, config: RenderBoardConfig) {
  const diamondHeight = (totalColumns + totalRows) * (tileH / 2);
  const originX = config.width / 2;
  const originY = (config.height - TILE_THICKNESS) / 2 - diamondHeight / 2;
  return { originX, originY, tileW, tileH };
}

export function buildVertexMap(
  totalRows: number, 
  totalColumns: number, 
  viewConfig: { originX: number; originY: number; tileW: number; tileH: number }): Vec2[][] {
  const vertices: Vec2[][] = [];
  for (let row = 0; row <= totalRows; row++) {
    const rowVerts: Vec2[] = [];
    for (let col = 0; col <= totalColumns; col++) {
      rowVerts.push(toIso(col, row, viewConfig));
    }
    vertices.push(rowVerts);
  }
  return vertices;
}

export function applyCameraTransform(config: RenderBoardConfig): void {
  config.ctx.translate(config.width / 2, config.height / 2);
  config.ctx.scale(config.camera.zoom, config.camera.zoom);
  config.ctx.translate(config.camera.x, config.camera.y);
  config.ctx.translate(-config.width / 2, -config.height / 2);
}

export function toIso(col: number, row: number, config: { originX: number; originY: number; tileW: number; tileH: number }): Vec2 {
  return {
    x: config.originX + (col - row) * (config.tileW / 2),
    y: config.originY + (col + row) * (config.tileH / 2),
  };
}
