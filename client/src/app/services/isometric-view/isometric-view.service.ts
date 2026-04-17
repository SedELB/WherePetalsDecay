import { Injectable } from '@angular/core';
import { ISO_ITEM_ASSETS, RENDER_CONSTANTS, STROKE_COLOR, TILE_LINE_WIDTH, TILE_THICKNESS } from '@app/constants/isometric.constants';
import { RenderBoardConfig, TileDepthParams, TileRenderParams } from '@app/interfaces/isometric-interfaces';
import { PlayerAction, TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import { applyCameraTransform, buildVertexMap, buildViewConfig, calculateAutoZoom, toIso } from './isometric-camera.helper';
import { drawIsometricTileBase } from './isometric-terrain.helper';
import { renderPlayers } from './player-render.helper';
import { drawPortcullisBars } from './portcullis-render.helper';
import { drawSanctuarySprite } from './sanctuary-render.helper';
import { drawSpawnIcon } from './spawn-render.helper';
const HALF_TILE_POSITION_OFFSET = 0.5;

const DIRECTION_KEY_PRESS_OFFSET = 8;
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
        const sideCenterColumn = totalColumns / 2 - HALF_TILE_POSITION_OFFSET;
        const sideCenterRow = totalRows / 2 - HALF_TILE_POSITION_OFFSET;

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
            south: { col: sideCenterColumn, row: totalRows + rowOffset },
            east: { col: totalColumns + rowOffset, row: sideCenterRow },
        };

        if (config.showDirectionalKeys !== false) {
            this.drawDirectionKey(config.ctx, 'W', positions.north, viewConfig, config.pressedDirectionKey === 'W');
            this.drawDirectionKey(config.ctx, 'A', positions.west, viewConfig, config.pressedDirectionKey === 'A');
            this.drawDirectionKey(config.ctx, 'S', positions.south, viewConfig, config.pressedDirectionKey === 'S');
            this.drawDirectionKey(config.ctx, 'D', positions.east, viewConfig, config.pressedDirectionKey === 'D');
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
                this.drawAssetsOnTile(params, col, row, config);

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

    private drawAssetsOnTile(params: TileRenderParams, col: number, row: number, config: RenderBoardConfig): void {
        const { context: ctx, surfaceTopLeft: north, surfaceTopRight: east,
            surfaceBottomRight: south, surfaceBottomLeft: west } = params;

        const cx = (west.x + east.x) / 2;
        const cy = (north.y + south.y) / 2;
        const tileW = east.x - west.x;
        const tileH = south.y - north.y;

        const renderData = { ctx, cx, cy, tileW, tileH };
        this.drawItemAt(params.tile, renderData, col, row, config);
    }

    private renderPlayers(vertices: Vec2[][], config: RenderBoardConfig): void {
        renderPlayers({
            ctx: config.ctx,
            players: this.players,
            playerPositions: this.playerPositions,
            vertices,
            config,
            getImage: this.getImage,
        });
    }

    private drawItemAt(
        tile: Tile,
        data: { ctx: CanvasRenderingContext2D; cx: number; cy: number; tileW: number; tileH: number },
        col: number,
        row: number,
        config: RenderBoardConfig,
    ): void {
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

        const drawRect = {
            x: data.cx - imgW / 2,
            y: data.cy - imgH / 2 + floatOffset + verticalShift,
            width: imgW,
            height: imgH,
        };

        if (tile.item === TileItem.Spawn) {
            const { isLocalSpawn, isFlagCarrierSpawn } = this.resolveSpawnFlags(col, row, config);
            drawSpawnIcon(data.ctx, itemImg, drawRect, isLocalSpawn, isFlagCarrierSpawn);
        } else {
            data.ctx.drawImage(itemImg, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
        }
    }

    private resolveSpawnFlags(col: number, row: number, config: RenderBoardConfig): { isLocalSpawn: boolean; isFlagCarrierSpawn: boolean } {
        if (!config.playerStartPositions) return { isLocalSpawn: false, isFlagCarrierSpawn: false };
        const startPos = config.localPlayerSocketId ? config.playerStartPositions[config.localPlayerSocketId] : null;
        const isLocalSpawn = !!(startPos && startPos.x === col && startPos.y === row);
        const flagCarrier = config.players?.find((p) => p.hasFlag && !p.hasAbandonned);
        const carrierStart = flagCarrier ? config.playerStartPositions[flagCarrier.socketId] : null;
        const isFlagCarrierSpawn = !!(carrierStart && carrierStart.x === col && carrierStart.y === row);
        return { isLocalSpawn, isFlagCarrierSpawn };
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


    // Method generated by Claude 4.6 Sonnet on April 15th 2026
    private drawDirectionKey(
        ctx: CanvasRenderingContext2D,
        keyChar: string,
        position: { col: number; row: number },
        viewConfig: { originX: number; originY: number; tileW: number; tileH: number },
        isPressed = false,
    ): void {
        const north = toIso(position.col, position.row, viewConfig);
        const east = toIso(position.col + 1, position.row, viewConfig);
        const south = toIso(position.col + 1, position.row + 1, viewConfig);
        const west = toIso(position.col, position.row + 1, viewConfig);
        const size = 60;
        const pressOffsetY = isPressed ? DIRECTION_KEY_PRESS_OFFSET : 0;
        const centerX = (north.x + south.x) / 2;
        const centerY = (north.y + south.y) / 2 + pressOffsetY;

        const KEY_STROKE_WIDTH = 4;
        const KEY_RADIUS = 8;

        ctx.save();
        ctx.transform(
            (east.x - north.x) / size, (east.y - north.y) / size,
            (west.x - north.x) / size, (west.y - north.y) / size,
            centerX, centerY,
        );

        ctx.translate(-size / 2, -size / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = KEY_STROKE_WIDTH;

        ctx.beginPath();
        ctx.moveTo(KEY_RADIUS, 0);
        ctx.lineTo(size - KEY_RADIUS, 0);
        ctx.quadraticCurveTo(size, 0, size, KEY_RADIUS);
        ctx.lineTo(size, size - KEY_RADIUS);
        ctx.quadraticCurveTo(size, size, size - KEY_RADIUS, size);
        ctx.lineTo(KEY_RADIUS, size);
        ctx.quadraticCurveTo(0, size, 0, size - KEY_RADIUS);
        ctx.lineTo(0, KEY_RADIUS);
        ctx.quadraticCurveTo(0, 0, KEY_RADIUS, 0);
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
