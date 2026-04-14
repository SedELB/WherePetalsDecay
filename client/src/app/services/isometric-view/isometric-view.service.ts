import { Injectable } from '@angular/core';
import { ISO_ITEM_ASSETS, RENDER_CONSTANTS, STROKE_COLOR, TILE_LINE_WIDTH, TILE_THICKNESS } from '@app/constants/isometric.constants';
import { RenderBoardConfig, TileDepthParams, TileRenderParams } from '@app/interfaces/isometric-interfaces';
import { TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import { applyCameraTransform, buildVertexMap, buildViewConfig, calculateAutoZoom } from './isometric-camera.helper';
import { drawIsometricTileBase } from './isometric-terrain.helper';
import { drawPortcullisBars } from './portcullis-render.helper';

const HALF_TILE_POSITION_OFFSET = 0.5;

@Injectable({ providedIn: 'root' })
export class IsometricViewService {
    private imageCache: Map<string, HTMLImageElement> = new Map();
    private players: Player[] = [];
    private playerPositions: Record<string, Vec2> = {};

    private getImage = (src: string): HTMLImageElement | null => {
        if (!src) return null;
        if (this.imageCache.has(src)) return this.imageCache.get(src) ?? null;
        const img = new Image();
        img.src = src;
        this.imageCache.set(src, img);
        return img;
    };

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
        this.renderPlayers(vertices, config);

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
                this.drawAssetsOnTile(params);

                // 3. Draw Portcullis Bars (top layer)
                if (tile.type === TileTexture.DoorClosed || tile.type === TileTexture.DoorOpened) {
                    drawPortcullisBars(
                        config.ctx,
                        { north: params.surfaceTopLeft, east: params.surfaceTopRight,
                            south: params.surfaceBottomRight, west: params.surfaceBottomLeft },
                        tile.type === TileTexture.DoorClosed ? 1 : 0,
                    );
                }
            }
        }
    }

    private drawAssetsOnTile(params: TileRenderParams): void {
        const { context: ctx, surfaceTopLeft: north, surfaceTopRight: east,
            surfaceBottomRight: south, surfaceBottomLeft: west } = params;

        const cx = (west.x + east.x) / 2;
        const cy = (north.y + south.y) / 2;
        const tileW = east.x - west.x;
        const tileH = south.y - north.y;

        const renderData = { ctx, cx, cy, tileW, tileH };

        this.drawItemAt(params.tile, renderData);
    }

    private renderPlayers(vertices: Vec2[][], config: RenderBoardConfig): void {
        const sortedPlayers = this.players
            .map((player) => ({ player, position: this.playerPositions[player.socketId] }))
            .filter((entry): entry is { player: Player; position: Vec2 } => !!entry.position)
            .sort((left, right) => {
                const leftDepth = left.position.x + left.position.y;
                const rightDepth = right.position.x + right.position.y;
                if (leftDepth !== rightDepth) return leftDepth - rightDepth;
                return left.position.x - right.position.x;
            });

        for (const entry of sortedPlayers) {
            this.drawPlayerAtPosition(entry.player, entry.position, vertices, config);
        }
    }

    private drawPlayerAtPosition(player: Player, position: Vec2, vertices: Vec2[][], config: RenderBoardConfig): void {
        if (!player?.character?.avatar) return;

        const projectedData = this.projectPlayerPosition(position, vertices);
        if (!projectedData) return;
        const ctx = config.ctx;

        const playerImg = this.getImage(player.character.avatar);
        if (!playerImg?.complete || playerImg.naturalWidth <= 0) return;

        const aspect = playerImg.naturalWidth / playerImg.naturalHeight;
        const imgW = projectedData.tileW * RENDER_CONSTANTS.playerWidthRatio;
        const imgH = (imgW / aspect) * RENDER_CONSTANTS.playerHeightAdjustment;

        this.drawPlayerShadow(ctx, {
            cx: projectedData.cx,
            cy: projectedData.cy,
            tileH: projectedData.tileH,
            imgW,
            imgH,
        });

        const charX = projectedData.cx - imgW / 2;
        const charY = projectedData.cy - imgH + (projectedData.tileH * RENDER_CONSTANTS.playerDepthOffset);
        const isLocal = player.socketId === config.localPlayerSocketId;
        let glowColor: string | null = null;

        if (config.isCTF) {
            const isTeamA = config.teamA?.some((teamPlayer) => teamPlayer.socketId === player.socketId);
            const isTeamB = config.teamB?.some((teamPlayer) => teamPlayer.socketId === player.socketId);

            if (isTeamA) glowColor = '#3b82f6';
            else if (isTeamB) glowColor = '#ef4444';
        } else if (isLocal) {
            glowColor = '#00f2fe';
        }

        if (glowColor) {
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 30; ctx.drawImage(playerImg, charX, charY, imgW, imgH);
            ctx.shadowBlur = 18; ctx.drawImage(playerImg, charX, charY, imgW, imgH);
            ctx.shadowBlur = 8; ctx.drawImage(playerImg, charX, charY, imgW, imgH);
            ctx.shadowBlur = 0; ctx.drawImage(playerImg, charX, charY, imgW, imgH);
            ctx.restore();
            return;
        }

        ctx.drawImage(playerImg, charX, charY, imgW, imgH);
    }

    private projectPlayerPosition(position: Vec2, vertices: Vec2[][]): {
        cx: number;
        cy: number;
        tileW: number;
        tileH: number;
    } | null {
        const totalRows = vertices.length - 1;
        const totalColumns = vertices[0]?.length ? vertices[0].length - 1 : 0;
        if (totalRows <= 0 || totalColumns <= 0) return null;

        const centerX = position.x + HALF_TILE_POSITION_OFFSET;
        const centerY = position.y + HALF_TILE_POSITION_OFFSET;

        if (centerX < 0 || centerY < 0 || centerX > totalColumns || centerY > totalRows) return null;

        const baseColumn = Math.min(Math.max(Math.floor(centerX), 0), totalColumns - 1);
        const baseRow = Math.min(Math.max(Math.floor(centerY), 0), totalRows - 1);

        const tx = centerX - baseColumn;
        const ty = centerY - baseRow;

        const topLeft = vertices[baseRow][baseColumn];
        const topRight = vertices[baseRow][baseColumn + 1];
        const bottomLeft = vertices[baseRow + 1][baseColumn];
        const bottomRight = vertices[baseRow + 1][baseColumn + 1];

        const topX = topLeft.x + ((topRight.x - topLeft.x) * tx);
        const topY = topLeft.y + ((topRight.y - topLeft.y) * tx);
        const bottomX = bottomLeft.x + ((bottomRight.x - bottomLeft.x) * tx);
        const bottomY = bottomLeft.y + ((bottomRight.y - bottomLeft.y) * tx);

        const cx = topX + ((bottomX - topX) * ty);
        const cy = topY + ((bottomY - topY) * ty);

        const tileW = Math.max(1, Math.abs(topRight.x - bottomLeft.x));
        const tileH = Math.max(1, Math.abs(bottomRight.y - topLeft.y));

        return {
            cx,
            cy,
            tileW,
            tileH,
        };
    }

    private drawItemAt(tile: Tile, data: { ctx: CanvasRenderingContext2D; cx: number; cy: number; tileW: number; tileH: number }): void {
        if (tile.item == null) return;

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
