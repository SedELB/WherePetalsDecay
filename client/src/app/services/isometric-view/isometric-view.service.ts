import { Injectable } from '@angular/core';
import { Vec2 } from '@common/vec2';
import { Player } from '@common/player';
import { TileRenderParams, RenderBoardConfig, TileColorSet, TileDepthParams } from '@app/interfaces/isometric-interfaces';

import {
  TILE_RATIO,
  TILE_THICKNESS,
  TILE_LINE_WIDTH,
  MIN_TILE_W,
  AUTO_ZOOM_FALLBACK,
  STROKE_COLOR,
  RENDER_CONSTANTS,
  TILE_COLORS,
  DEFAULT_COLOR,
  ISO_ITEM_ASSETS,
  ISO_TEXTURE_ASSETS,
} from '@app/constants/isometric.constants';
import { Tile } from '@common/tile';

@Injectable({
  providedIn: 'root',
})
export class IsometricViewService {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private players: Player[] = [];
  private playerPositions: Record<string, Vec2> = {};

  private getImage(src: string): HTMLImageElement | null {
    if (!src) return null;
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src) ?? null;
    }
    const img = new Image();
    img.src = src;
    this.imageCache.set(src, img);
    return img;
  }

  private buildPolygonPath(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
  }


  renderBoard(config: RenderBoardConfig): void {
    if (!config.grid?.length || !config.grid[0]?.length) return;
    this.players = config.players;
    this.playerPositions = config.playerPositions;

    const totalRows = config.grid.length;
    const totalColumns = config.grid[0].length;

    // Optimization Phase
    const { tileW, tileH } = this.calculateAutoZoom(totalRows, totalColumns, config);
    const viewConfig = this.buildViewConfig(totalRows, totalColumns, tileW, tileH, config);
    const vertices = this.buildVertexMap(totalRows, totalColumns, viewConfig);

    // Camera Phase
    config.ctx.save();
    this.applyCameraTransform(config);

    // Rendering Phase
    this.renderGridTiles(vertices, totalRows, totalColumns, config);

    config.ctx.restore();
  }

  private calculateAutoZoom(totalRows: number, totalColumns: number, config: RenderBoardConfig): { tileW: number, tileH: number } {
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

  private buildViewConfig(totalRows: number, totalColumns: number, tileW: number, tileH: number, config: RenderBoardConfig) {
    const diamondHeight = (totalColumns + totalRows) * (tileH / 2);
    const originX = config.width / 2;
    const originY = (config.height - TILE_THICKNESS) / 2 - diamondHeight / 2;
    return { originX, originY, tileW, tileH };
  }

  private buildVertexMap(
    totalRows: number, 
    totalColumns: number, 
    viewConfig: { originX: number; originY: number; tileW: number; tileH: number }): Vec2[][] {
    const vertices: Vec2[][] = [];
    for (let row = 0; row <= totalRows; row++) {
      const rowVerts: Vec2[] = [];
      for (let col = 0; col <= totalColumns; col++) {
        rowVerts.push(this.toIso(col, row, viewConfig));
      }
      vertices.push(rowVerts);
    }
    return vertices;
  }

  private applyCameraTransform(config: RenderBoardConfig): void {
    config.ctx.translate(config.width / 2, config.height / 2);
    config.ctx.scale(config.camera.zoom, config.camera.zoom);
    config.ctx.translate(config.camera.x, config.camera.y);
    config.ctx.translate(-config.width / 2, -config.height / 2);
  }

  private renderGridTiles(vertices: Vec2[][], totalRows: number, totalColumns: number, config: RenderBoardConfig): void {
    config.ctx.lineWidth = TILE_LINE_WIDTH;
    config.ctx.lineJoin = 'round';
    config.ctx.strokeStyle = STROKE_COLOR;

    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalColumns; col++) {
        const tileParams: TileRenderParams = {
          context: config.ctx,
          tile: config.grid[row][col],
          surfaceTopLeft: vertices[row][col],
          surfaceTopRight: vertices[row][col + 1],
          surfaceBottomRight: vertices[row + 1][col + 1],
          surfaceBottomLeft: vertices[row + 1][col],
        };
        
        const depthParams: TileDepthParams = {
          context: config.ctx,
          thickness: TILE_THICKNESS,
          rowIndex: row,
          totalRows,
          columnIndex: col,
          totalColumns,
          surfaceTopRight: vertices[row][col + 1],
          surfaceBottomRight: vertices[row + 1][col + 1],
          surfaceBottomLeft: vertices[row + 1][col],
        };
        this.drawIsometricTile(tileParams, depthParams, config);
      }
    }
  }


  private drawTileDepth(params: TileDepthParams, colors: TileColorSet): void {
    const { context: ctx, rowIndex, columnIndex, totalRows, totalColumns, thickness,
      surfaceBottomLeft: west, surfaceBottomRight: south, surfaceTopRight: east } = params;
    const baseEast = { x: east.x, y: east.y + thickness };
    const baseSouth = { x: south.x, y: south.y + thickness };
    const baseWest = { x: west.x, y: west.y + thickness };

    // Left side
    if (rowIndex === totalRows - 1) {
      this.buildPolygonPath(ctx, [west, south, baseSouth, baseWest]);
      ctx.fillStyle = colors.left;
      ctx.fill();
      ctx.stroke();
    }
    
    // Right side
    if (columnIndex === totalColumns - 1) {
      this.buildPolygonPath(ctx, [south, east, baseEast, baseSouth]);
      ctx.fillStyle = colors.right;
      ctx.fill();
      ctx.stroke();
    }
  }


  private drawAssetsOnTile(params: TileRenderParams, col: number, row: number, config: RenderBoardConfig): void {
    const { context: ctx, surfaceTopLeft: north, surfaceTopRight: east, 
            surfaceBottomRight: south, surfaceBottomLeft: west } = params;

    const cx = (west.x + east.x) / 2;
    const cy = (north.y + south.y) / 2;
    const tileW = east.x - west.x;
    const tileH = south.y - north.y;

    const renderData = { ctx, cx, cy, tileW, tileH };

    this.drawItemAt(params.tile, renderData);
    this.drawPlayerAt(col, row, renderData, config);
  }

  private drawItemAt(tile: Tile, data: { ctx: CanvasRenderingContext2D; cx: number; cy: number; tileW: number; tileH: number }): void {
    if (tile.item == null) return;
    
    // Using ISO specific assets instead of the editor tool assets
    const imageSrc = ISO_ITEM_ASSETS[tile.item];
    if (!imageSrc) return;

    const itemImg = this.getImage(imageSrc);
    if (!itemImg?.complete || itemImg.naturalWidth <= 0) return;

    const aspect = itemImg.naturalWidth / itemImg.naturalHeight;
    const imgW = data.tileW * RENDER_CONSTANTS.itemWidthRatio;
    const imgH = imgW / aspect;

    const floatOffset = Math.sin(Date.now() / RENDER_CONSTANTS.itemFloatSpeed) *
        (data.tileH * RENDER_CONSTANTS.itemFloatAmplitude) -
        (data.tileH * RENDER_CONSTANTS.itemFloatBaseOffset);

    data.ctx.drawImage(itemImg, data.cx - imgW / 2, data.cy - imgH / 2 + floatOffset, imgW, imgH);
  }

  private drawPlayerAt(
     col: number, 
     row: number, 
     data: { ctx: CanvasRenderingContext2D; cx: number; cy: number; tileW: number; tileH: number }, 
     config: RenderBoardConfig,
    ): void {
      
    const playerAtTile = this.players.find(p => {
        const pos = this.playerPositions[p.socketId];
        return pos?.x === col && pos?.y === row;
    });

    if (!playerAtTile?.character?.avatar) return;

    const playerImg = this.getImage(playerAtTile.character.avatar);
    if (!playerImg?.complete || playerImg.naturalWidth <= 0) return;

    const aspect = playerImg.naturalWidth / playerImg.naturalHeight;
    const imgW = data.tileW * RENDER_CONSTANTS.playerWidthRatio;
    const imgH = (imgW / aspect) * RENDER_CONSTANTS.playerHeightAdjustment;

    this.drawPlayerShadow(data.ctx, { cx: data.cx, cy: data.cy, tileH: data.tileH, imgW, imgH });

    const charX = data.cx - imgW / 2;
    const charY = data.cy - imgH + (data.tileH * RENDER_CONSTANTS.playerDepthOffset);
    const isLocal = playerAtTile.socketId === config.localPlayerSocketId;

    if (isLocal) {
        data.ctx.save();
        data.ctx.shadowColor = '#00f2fe';
        data.ctx.shadowBlur = 12;
        data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
        data.ctx.shadowBlur = 0;
        data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
        data.ctx.restore();
    } else {
        data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
    }
  }

  private drawPlayerShadow(ctx: CanvasRenderingContext2D, data: { cx: number; cy: number; tileH: number; imgW: number; imgH: number }): void {
    const shadowY = data.cy + (data.tileH * RENDER_CONSTANTS.shadowOffsetYRatio);
    const radiusX = data.imgW * RENDER_CONSTANTS.shadowRadiusXRatio;
    const radiusY = data.imgH * RENDER_CONSTANTS.shadowRadiusYRatio;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(data.cx, shadowY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }


  private drawTileTexture(ctx: CanvasRenderingContext2D, tile: Tile, north: Vec2, east: Vec2, west: Vec2): void {
    const imageSrc = ISO_TEXTURE_ASSETS[tile.type];
    if (!imageSrc) return;

    const tileImg = this.getImage(imageSrc);
    if (!tileImg?.complete || tileImg.naturalWidth <= 0) return;

    ctx.save();
    ctx.clip();
    const iw = tileImg.naturalWidth;
    const ih = tileImg.naturalHeight;

    // Square image to diamond image transformation
    ctx.transform(
      (east.x - north.x) / iw, (east.y - north.y) / iw,
      (west.x - north.x) / ih, (west.y - north.y) / ih,
      north.x, north.y,
    );

    ctx.drawImage(tileImg, 0, 0);
    ctx.restore();
  }

  private drawIsometricTile(params: TileRenderParams, depthParams: TileDepthParams, config: RenderBoardConfig): void {
    const { context: ctx, tile, surfaceTopLeft: north, surfaceTopRight: east,
      surfaceBottomRight: south, surfaceBottomLeft: west } = params;
    const colors = TILE_COLORS[tile.type] || DEFAULT_COLOR;

    this.buildPolygonPath(ctx, [north, east, south, west]);
    ctx.fillStyle = colors.top;
    ctx.fill();

    // Draw the tile texture
    this.drawTileTexture(ctx, tile, north, east, west);

    const col = depthParams.columnIndex;
    const row = depthParams.rowIndex;
    const isReachable = config.reachableTiles?.some((t) => t.x === col && t.y === row);
    const isTeleportable = config.teleportableTiles?.some((t) => t.x === col && t.y === row);

    // Highlight of available tiles to move to
    if (isReachable || isTeleportable) {
      ctx.save();
      this.buildPolygonPath(ctx, [north, east, south, west]);
      ctx.fillStyle = isTeleportable ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.4)';
      ctx.fill();
      ctx.restore();
    }

    ctx.stroke();
    this.drawTileDepth(depthParams, colors);
    this.drawAssetsOnTile(params, col, row, config);
  }


  private toIso(col: number, row: number, config: { originX: number; originY: number; tileW: number; tileH: number }): Vec2 {
    return {
      x: config.originX + (col - row) * (config.tileW / 2),
      y: config.originY + (col + row) * (config.tileH / 2),
    };
  }
}
