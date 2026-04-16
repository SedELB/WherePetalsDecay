import { Injectable } from '@angular/core';
import { ISO_ITEM_ASSETS, RENDER_CONSTANTS, STROKE_COLOR, TILE_LINE_WIDTH, TILE_THICKNESS } from '@app/constants/isometric.constants';
import { RenderBoardConfig, TileDepthParams, TileRenderParams } from '@app/interfaces/isometric-interfaces';
import { PlayerAction, TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import { applyCameraTransform, buildVertexMap, buildViewConfig, calculateAutoZoom, toIso } from './isometric-camera.helper';
import { drawIsometricTileBase } from './isometric-terrain.helper';
import { drawPortcullisBars } from './portcullis-render.helper';
import { drawSanctuarySprite } from './sanctuary-render.helper';
const HALF_TILE_POSITION_OFFSET = 0.5;
const isSanctuary = (item: TileItem): boolean =>
    item === TileItem.HealingSanctuary || item === TileItem.CombatSanctuary;

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
        const rowOffset = 3;

        const { tileW, tileH } = calculateAutoZoom(totalRows, totalColumns, config);
        const viewConfig = buildViewConfig(totalRows, totalColumns, tileW, tileH, config);
        const vertices = buildVertexMap(totalRows, totalColumns, viewConfig);

        config.ctx.save();
        applyCameraTransform(config);

        this.renderGridTiles(vertices, totalRows, totalColumns, config);
        this.renderPlayers(vertices, config);

        const positions = {
            north: { col: Math.floor(totalColumns / 2) - 1, row: - rowOffset },
            west: { col: -2, row: Math.floor(totalRows / 2) - 1 },
            south: { col: Math.floor(totalColumns / 2) - 1, row: totalRows + rowOffset },
            east: { col: totalColumns + rowOffset, row: Math.floor(totalRows / 2) - 1 },
        };

        if (config.showDirectionalKeys !== false) {
            this.drawDirectionKey(config.ctx, 'W', positions.north.col, positions.north.row, viewConfig);
            this.drawDirectionKey(config.ctx, 'A', positions.west.col, positions.west.row, viewConfig);
            this.drawDirectionKey(config.ctx, 'S', positions.south.col, positions.south.row, viewConfig);
            this.drawDirectionKey(config.ctx, 'D', positions.east.col, positions.east.row, viewConfig);
        }

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
                        {
                            north: params.surfaceTopLeft, east: params.surfaceTopRight,
                            south: params.surfaceBottomRight, west: params.surfaceBottomLeft,
                        },
                        tile.type === TileTexture.DoorClosed ? 1 : 0,
                        `${col},${row}`,
                    );
                }

                // 4. Draw Sancturaries (2x2)
                this.drawSanctuaryOnTile(row, col, vertices, config);
            }
        }
    }

    private drawSanctuaryOnTile(row: number, col: number, vertices: Vec2[][], config: RenderBoardConfig): void {
        const tile = config.grid[row][col];
        if (!tile.item || !isSanctuary(tile.item)) return;

        const isBottom = row > 0 && config.grid[row - 1][col].item === tile.item;
        const isRight = col > 0 && config.grid[row][col - 1].item === tile.item;
        const isDiagonal = row > 0 && col > 0 && config.grid[row - 1][col - 1].item === tile.item;

        if (!(isBottom && isRight && isDiagonal)) return;

        const sanctuaryCells = [
            { x: col, y: row },
            { x: col - 1, y: row },
            { x: col, y: row - 1 },
            { x: col - 1, y: row - 1 },
        ];

        const isInactive = this.isAnySanctuaryCellInactive(sanctuaryCells, config.inactiveSanctuaries ?? []);

        const isGlowing = !isInactive && (config.actionHighlightTiles?.some(
            (h) => h.type === PlayerAction.Sanctuary && sanctuaryCells.some((c) => c.x === h.pos.x && c.y === h.pos.y),
        ) ?? false);

        drawSanctuarySprite(
            config.ctx,
            tile.item,
            {
                north: vertices[row - 1][col - 1],
                east: vertices[row - 1][col + 1],
                south: vertices[row + 1][col + 1],
                west: vertices[row + 1][col - 1],
            },
            this.getImage,
            { isGlowing, isInactive },
        );
    }

    private isAnySanctuaryCellInactive(sanctuaryCells: Vec2[], inactiveSanctuaries: Vec2[]): boolean {
        return inactiveSanctuaries.some((inactivePos) =>
            sanctuaryCells.some((cell) => cell.x === inactivePos.x && cell.y === inactivePos.y),
        );
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

        const playerImg = this.getImage(player.character.avatar);
        if (!playerImg?.complete || playerImg.naturalWidth <= 0) return;

        const aspect = playerImg.naturalWidth / playerImg.naturalHeight;
        const imgW = projectedData.tileW * RENDER_CONSTANTS.playerWidthRatio;
        const imgH = (imgW / aspect) * RENDER_CONSTANTS.playerHeightAdjustment;

        this.drawPlayerShadow(config.ctx, {
            cx: projectedData.cx,
            cy: projectedData.cy,
            tileH: projectedData.tileH,
            imgW,
            imgH,
        });

        this.drawPlayerSprite(
            config.ctx,
            playerImg,
            {
                x: projectedData.cx - imgW / 2,
                y: projectedData.cy - imgH + (projectedData.tileH * RENDER_CONSTANTS.playerDepthOffset),
                w: imgW,
                h: imgH,
                isFlipped: config.flipXMap?.[player.socketId] ?? false,
                glowColor: this.getPlayerGlowColor(player, config),
            },
        );
    }

    private getPlayerGlowColor(player: Player, config: RenderBoardConfig): string | null {
        if (config.isCTF) {
            if (config.teamA?.some((t) => t.socketId === player.socketId)) return '#3b82f6';
            if (config.teamB?.some((t) => t.socketId === player.socketId)) return '#ef4444';
            return null;
        }

        return player.socketId === config.localPlayerSocketId ? '#00f2fe' : null;
    }

    private drawPlayerSprite(
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        params: { x: number; y: number; w: number; h: number; isFlipped: boolean; glowColor: string | null },
    ): void {
        const { x, y, w, h, isFlipped, glowColor } = params;
        ctx.save();
        if (glowColor) {
            ctx.shadowColor = glowColor;
        }

        if (isFlipped) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.scale(-1, 1);
            ctx.translate(-(x + w / 2), -(y + h / 2));
        }

        if (glowColor) {
            ctx.shadowBlur = 30; ctx.drawImage(img, x, y, w, h);
            ctx.shadowBlur = 18; ctx.drawImage(img, x, y, w, h);
            ctx.shadowBlur = 8; ctx.drawImage(img, x, y, w, h);
            ctx.shadowBlur = 0; ctx.drawImage(img, x, y, w, h);
        } else {
            ctx.drawImage(img, x, y, w, h);
        }

        ctx.restore();
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

    // Method generated by Claude 4.6 Sonnet on April 15th 2026
    private drawDirectionKey(
        ctx: CanvasRenderingContext2D,
        keyChar: string,
        col: number,
        row: number,
        viewConfig: { originX: number; originY: number; tileW: number; tileH: number },
    ): void {
        const north = toIso(col, row, viewConfig);
        const east = toIso(col + 1, row, viewConfig);
        const west = toIso(col, row + 1, viewConfig);
        const size = 60;
        ctx.save();

        ctx.transform(
            (east.x - north.x) / size, (east.y - north.y) / size,
            (west.x - north.x) / size, (west.y - north.y) / size,
            north.x, north.y,
        );

        ctx.translate(-size / 2, -size / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;

        const r = 8;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(size - r, 0);
        ctx.quadraticCurveTo(size, 0, size, r);
        ctx.lineTo(size, size - r);
        ctx.quadraticCurveTo(size, size, size - r, size);
        ctx.lineTo(r, size);
        ctx.quadraticCurveTo(0, size, 0, size - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#3d3939ff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(keyChar, size / 2, size / 2 + 2);
        ctx.restore();
    }
}
