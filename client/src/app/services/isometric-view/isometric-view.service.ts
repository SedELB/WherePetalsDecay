import { Injectable } from '@angular/core';
import { ISO_ITEM_ASSETS, RENDER_CONSTANTS, STROKE_COLOR, TILE_LINE_WIDTH, TILE_THICKNESS } from '@app/constants/isometric.constants';
import { RenderBoardConfig, TileDepthParams, TileRenderParams } from '@app/interfaces/isometric-interfaces';
import { TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import { applyCameraTransform, buildVertexMap, buildViewConfig, calculateAutoZoom } from './isometric-camera.helper';
import { drawIsometricTileBase } from './isometric-terrain.helper';
import { drawSanctuarySprite } from './sanctuary-render.helper';
import { drawPortcullisBars } from './portcullis-render.helper';

@Injectable({ providedIn: 'root' })
export class IsometricViewService {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private players: Player[] = [];
  private playerPositions: Record<string, Vec2> = {};
  private doorAnimations = new Map<string, { current: number; target: number; lastTime: number }>();

  private static readonly doorAnimSpeed = 4;

  private getImage = (src: string): HTMLImageElement | null => {
    if (!src) return null;
    if (this.imageCache.has(src)) return this.imageCache.get(src) ?? null;
    const img = new Image();
    img.src = src;
    this.imageCache.set(src, img);
    return img;
  };

  triggerDoorAnimation(x: number, y: number, newType: TileTexture): void {
    const key = `${x},${y}`;
    const existing = this.doorAnimations.get(key);
    const target = newType === TileTexture.DoorClosed ? 1 : 0;
    this.doorAnimations.set(key, { current: existing?.current ?? (1 - target), target, lastTime: Date.now() });
  }

  private getDoorProgress(col: number, row: number, tile: Tile): number {
    const key = `${col},${row}`;
    const anim = this.doorAnimations.get(key);
    if (!anim) return tile.type === TileTexture.DoorClosed ? 1 : 0;

    const now = Date.now();
    const dt = (now - anim.lastTime) / RENDER_CONSTANTS.oneSecondMs;
    anim.lastTime = now;

    const step = IsometricViewService.doorAnimSpeed * dt;
    if (anim.current < anim.target) anim.current = Math.min(anim.current + step, anim.target);
    else anim.current = Math.max(anim.current - step, anim.target);

    if (anim.current === anim.target) this.doorAnimations.delete(key);
    return anim.current;
  }

  renderBoard(config: RenderBoardConfig): void {
    if (!config.grid?.length || !config.grid[0]?.length) return;
    this.players = config.players;
    this.playerPositions = config.playerPositions;

    const totalRows = config.grid.length;
    const totalColumns = config.grid[0].length;

    const { tileW, tileH } = calculateAutoZoom(totalRows, totalColumns, config);
    const viewConfig = buildViewConfig(totalRows, totalColumns, tileW, tileH, config);
    const vertices = buildVertexMap(totalRows, totalColumns, viewConfig);

    config.ctx.save();
    applyCameraTransform(config);

    this.renderGridTiles(vertices, totalRows, totalColumns, config);

    config.ctx.restore();
  }

  private renderGridTiles(vertices: Vec2[][], totalRows: number, totalColumns: number, config: RenderBoardConfig): void {
    config.ctx.lineWidth = TILE_LINE_WIDTH;
    config.ctx.lineJoin = 'round';
    config.ctx.strokeStyle = STROKE_COLOR;

    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalColumns; col++) {
        const tile = config.grid[row][col];
        const params: TileRenderParams = {
          context: config.ctx, tile,
          surfaceTopLeft: vertices[row][col],
          surfaceTopRight: vertices[row][col + 1],
          surfaceBottomRight: vertices[row + 1][col + 1],
          surfaceBottomLeft: vertices[row + 1][col],
        };

        const depthParams: TileDepthParams = {
          context: config.ctx,
          thickness: TILE_THICKNESS,
          rowIndex: row, totalRows,
          columnIndex: col, totalColumns,
          surfaceTopRight: vertices[row][col + 1],
          surfaceBottomRight: vertices[row + 1][col + 1],
          surfaceBottomLeft: vertices[row + 1][col],
        };

        // 1. Draw base tile and depth
        drawIsometricTileBase(params, depthParams, config, this.getImage);

        // 2. Draw Entities
        this.drawAssetsOnTile(params, col, row, config);

        // 3. Render Special Structures
        this.renderPortcullis(tile, col, row, config, params);
        this.renderSanctuary(tile, col, row, config, vertices);
      }
    }
  }

  private renderPortcullis(tile: Tile, col: number, row: number, config: RenderBoardConfig, params: TileRenderParams): void {
    if (tile.type !== TileTexture.DoorClosed && tile.type !== TileTexture.DoorOpened) return;
    const progress = this.getDoorProgress(col, row, tile);
    drawPortcullisBars(
      config.ctx,
      { north: params.surfaceTopLeft, east: params.surfaceTopRight, south: params.surfaceBottomRight, west: params.surfaceBottomLeft },
      progress,
    );
  }

  private renderSanctuary(
    tile: Tile,
    col: number,
    row: number,
    config: RenderBoardConfig,
    vertices: Vec2[][],
  ): void {
    const isSanctuary = tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary;
    if (!isSanctuary) return;

    const totalRows = config.grid.length;
    const totalCols = config.grid[0].length;

    const isBottomRight = (col + 1 >= totalCols || config.grid[row]?.[col + 1]?.item !== tile.item)
      && (row + 1 >= totalRows || config.grid[row + 1]?.[col]?.item !== tile.item);

    if (isBottomRight && row >= 1 && col >= 1 && tile.item) {
      drawSanctuarySprite(config.ctx, tile.item, {
        north: vertices[row - 1][col - 1],
        east: vertices[row - 1][col + 1],
        south: vertices[row + 1][col + 1],
        west: vertices[row + 1][col - 1],
      }, this.getImage);
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
    if (tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary) return;

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

    const verticalShift = data.tileH * RENDER_CONSTANTS.itemVerticalOffset;

    this.drawItemShadow(data.ctx, { cx: data.cx, cy: data.cy, tileW: data.tileW, tileH: data.tileH, floatOffset, verticalShift });
    data.ctx.drawImage(itemImg, data.cx - imgW / 2, data.cy - imgH / 2 + floatOffset + verticalShift, imgW, imgH);
  }

  private drawPlayerAt(
    col: number, row: number,
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
    const glowColor = this.getPlayerGlowColor(playerAtTile, config);

    if (glowColor) {
      data.ctx.save();
      data.ctx.shadowColor = glowColor;
      data.ctx.shadowBlur = 30; data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
      data.ctx.shadowBlur = 18; data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
      data.ctx.shadowBlur = 8; data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
      data.ctx.shadowBlur = 0; data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
      data.ctx.restore();
    } else {
      data.ctx.drawImage(playerImg, charX, charY, imgW, imgH);
    }
  }

  private getPlayerGlowColor(player: Player, config: RenderBoardConfig): string | null {
    const isLocal = player.socketId === config.localPlayerSocketId;
    let glowColor: string | null = null;

    if (config.isCTF) {
      const isTeamA = config.teamA?.some((p) => p.socketId === player.socketId);
      const isTeamB = config.teamB?.some((p) => p.socketId === player.socketId);
      if (isTeamA) glowColor = '#3b82f6';
      else if (isTeamB) glowColor = '#ef4444';
    }

    if (isLocal) {
      glowColor = config.isLocalPlayerTurn ? '#ffffff' : (glowColor ?? '#00f2fe');
    }
    return glowColor;
  }

  private drawItemShadow(
    ctx: CanvasRenderingContext2D,
    data: { cx: number; cy: number; tileW: number; tileH: number; floatOffset: number; verticalShift: number },
  ): void {
    const shadowY = data.cy + (data.tileH * RENDER_CONSTANTS.itemShadowOffsetYRatio) + data.verticalShift;
    const heightAboveGround = -data.floatOffset / (data.tileH * RENDER_CONSTANTS.itemFloatBaseOffset);
    const scale = RENDER_CONSTANTS.itemShadowScaleMin + RENDER_CONSTANTS.itemShadowScaleRange * (1 - heightAboveGround);
    const alpha = RENDER_CONSTANTS.itemShadowAlphaMin + RENDER_CONSTANTS.itemShadowAlphaRange * (1 - heightAboveGround);

    const radiusX = data.tileW * RENDER_CONSTANTS.itemShadowRadiusXRatio * scale;
    const radiusY = data.tileH * RENDER_CONSTANTS.itemShadowRadiusYRatio * scale;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(data.cx, shadowY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
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
}
