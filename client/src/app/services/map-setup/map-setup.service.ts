import { Injectable } from '@angular/core';
import { MouseEventType } from '@app/constants/map-setup-page-constant';
import {
    CellInteractionParams,
    MapSetupInteractionState,
    MapSetupResetResult,
    MapSetupSelection,
    TileItemCounts,
    TileParams,
} from '@app/services/map-setup.types';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { TileItem, TileTexture } from '@common/enums';
import { type PlacedObject, Game } from '@common/game';
import type { GameDraftForValidation } from '@common/interfaces/game-validation';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

@Injectable({ providedIn: 'root' })
export class MapSetupService {
    private lastDragPosition: Vec2 | null = null;

    constructor(private readonly tileItemCountService: TileItemCountService) {}

    initializeGridIfEmpty(game: Game): void {
        if (!game.grid?.length || game.grid.length !== game.size.rows || game.grid[0]?.length !== game.size.cols) {
            game.grid = Array.from({ length: game.size.rows }, () =>
                Array.from({ length: game.size.cols }, (): Tile => ({ type: TileTexture.Floor, item: null })),
            );
        }
    }

    // Bresenham Algorithm
    private drawStraightLine(startRow: number, startCol: number, endRow: number, endCol: number): Vec2[] {
        const path: Vec2[] = [];
        const dx = Math.abs(endCol - startCol);
        const dy = Math.abs(endRow - startRow);
        const sx = startCol < endCol ? 1 : -1;
        const sy = startRow < endRow ? 1 : -1;
        let row = startRow;
        let col = startCol;
        let err = dx - dy;

        while (row !== endRow || col !== endCol) {
            path.push({ y: row, x: col });
            const e2 = err * 2;
            if (e2 > -dy) {
                err -= dy;
                col += sx;
            }
            if (e2 < dx) {
                err += dx;
                row += sy;
            }
        }
        path.push({ y: endRow, x: endCol });
        return path;
    }

    private applyTile(params: TileParams): void {
        const { game, rowIndex, colIndex, tileAttribute, counts } = params;
        const currentTile = game.grid[rowIndex]?.[colIndex];

        if (Object.values(TileItem).includes(tileAttribute as TileItem)) {
            if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(currentTile.type)) {
                throw new Error('On ne peut pas placer cet object sur une tuile de terrain');
            }
            const item = tileAttribute as TileItem;
            if (this.isSanctuary(item)) {
                if (this.tileItemCountService.verifyEnoughTileItem(counts, item) && this.canPlaceSanctuary(game, rowIndex, colIndex)) {
                    this.placeSanctuary(game, rowIndex, colIndex, item, counts);
                }
            } else if (!currentTile.item && this.tileItemCountService.verifyEnoughTileItem(counts, item)) {
                currentTile.item = item;
                this.tileItemCountService.decreaseTileItemCount(counts, item);
            }
        } else {
            if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(tileAttribute as TileTexture) && currentTile.item) {
                this.deleteTile({ ...params, tileAttribute });
            }
            if (tileAttribute === TileTexture.DoorClosed || tileAttribute === TileTexture.DoorOpened) {
                currentTile.type = this.inverseDoor(currentTile.type);
            } else if (currentTile.type !== tileAttribute) {
                currentTile.type = tileAttribute as TileTexture;
            }
        }
    }

    private inverseDoor(oldType: TileTexture): TileTexture {
        return oldType === TileTexture.DoorClosed ? TileTexture.DoorOpened : TileTexture.DoorClosed;
    }

    private isSanctuary(item: TileItem): boolean {
        return item === TileItem.HealingSanctuary || item === TileItem.CombatSanctuary;
    }

    private canPlaceSanctuary(game: Game, rowIndex: number, colIndex: number): boolean {
        if (rowIndex + 1 >= game.grid.length || colIndex + 1 >= (game.grid[0]?.length ?? 0)) return false;
        const cells = [
            game.grid[rowIndex][colIndex], game.grid[rowIndex][colIndex + 1],
            game.grid[rowIndex + 1][colIndex], game.grid[rowIndex + 1][colIndex + 1],
        ];
        return cells.every(t => t.type === TileTexture.Floor && t.item === null);
    }

    private placeSanctuary(game: Game, rowIndex: number, colIndex: number, item: TileItem, counts: TileItemCounts): void {
        game.grid[rowIndex][colIndex].item = game.grid[rowIndex][colIndex + 1].item = item;
        game.grid[rowIndex + 1][colIndex].item = game.grid[rowIndex + 1][colIndex + 1].item = item;
        this.tileItemCountService.decreaseTileItemCount(counts, item);
    }

    private getSanctuaryTopLefts(game: Game, item: TileItem): Vec2[] {
        const top = [];
        const con = new Set<string>();
        for (let y = 0; y < game.grid.length; y++) {
            for (let x = 0; x < game.grid[y].length; x++) {
                if (game.grid[y][x].item === item && !con.has(`${x},${y}`)) {
                    top.push({ y, x });
                    if (game.grid[y]?.[x + 1]?.item === item && game.grid[y + 1]?.[x]?.item === item && game.grid[y + 1]?.[x + 1]?.item === item) {
                        con.add(`${x},${y}`).add(`${x + 1},${y}`).add(`${x},${y + 1}`).add(`${x + 1},${y + 1}`);
                    } else {
                        con.add(`${x},${y}`);
                    }
                }
            }
        }
        return top;
    }

    private findSanctuaryTopLeft(game: Game, rowIndex: number, colIndex: number, item: TileItem): Vec2 {
        const match = this.getSanctuaryTopLefts(game, item).find(
            ({ y, x }) => (rowIndex === y || rowIndex === y + 1) && (colIndex === x || colIndex === x + 1));
        if (match) return match;

        let r = rowIndex;
        let c = colIndex;
        if (r > 0 && game.grid[r - 1]?.[c]?.item === item) r--;
        if (c > 0 && game.grid[r]?.[c - 1]?.item === item) c--;
        return { y: r, x: c };
    }

    private deleteSanctuary(game: Game, rowIndex: number, colIndex: number, item: TileItem, counts: TileItemCounts): void {
        const { y, x } = this.findSanctuaryTopLeft(game, rowIndex, colIndex, item);
        game.grid[y][x].item = game.grid[y][x + 1].item = null;
        game.grid[y + 1][x].item = game.grid[y + 1][x + 1].item = null;
        this.tileItemCountService.increaseTileItemCount(counts, item);
    }

    private deleteTile(params: TileParams): void {
        const { game, rowIndex, colIndex, tileAttribute, event, counts } = params;
        const currentTile = game.grid[rowIndex]?.[colIndex];
        const currItem = currentTile.item;

        const overwritingWithWall = [TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(tileAttribute as TileTexture);

        if (currItem && this.isSanctuary(currItem) && (event.shiftKey || overwritingWithWall)) {
            this.deleteSanctuary(game, rowIndex, colIndex, currItem, counts);
            return;
        }

        // If shift key is pressed delete the item
        if (currItem && event.shiftKey) {
            currentTile.item = null;
            this.tileItemCountService.increaseTileItemCount(counts, currItem);
        } else if (!event.shiftKey && currentTile.type !== TileTexture.Floor && !overwritingWithWall) {
            currentTile.type = TileTexture.Floor;
        }

        if (overwritingWithWall && currItem && !this.isSanctuary(currItem)) {
            currentTile.item = null;
            this.tileItemCountService.increaseTileItemCount(counts, currItem);
        }
    }

    private removeBlockingItemIfNeeded(game: Game, cellY: number, cellX: number, activeTileTexture: TileTexture, counts: TileItemCounts): void {
        const gameTile = game.grid[cellY][cellX];
        if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(activeTileTexture) && gameTile.item) {
            const removedItem = gameTile.item;
            if (this.isSanctuary(removedItem)) {
                this.deleteSanctuary(game, cellY, cellX, removedItem, counts);
            } else {
                gameTile.item = null;
                this.tileItemCountService.increaseTileItemCount(counts, removedItem);
            }
        }
    }

    getObjectAt(game: Game, x: number, y: number): Tile | undefined {
        return game.grid[x]?.[y];
    }

    selectTileTexture(activeTileTexture: TileTexture | null, activeTileItem: TileItem | null, type: TileTexture): MapSetupSelection {
        const nextActiveTileTexture = activeTileTexture === type ? null : type;
        return { activeTileTexture: nextActiveTileTexture, activeTileItem: nextActiveTileTexture != null ? null : activeTileItem };
    }

    selectTileItem(activeTileItem: TileItem | null, activeTileTexture: TileTexture | null, type: TileItem): MapSetupSelection {
        const nextActiveTileItem = activeTileItem === type ? null : type;
        return { activeTileTexture: nextActiveTileItem != null ? null : activeTileTexture, activeTileItem: nextActiveTileItem };
    }

    applyActiveSelection(params: TileParams): void {
        if (params.tileAttribute) this.applyTile(params);
    }

    handleCellMouseDown(params: CellInteractionParams): MapSetupInteractionState {
        const {
            rowIndex,
            colIndex,
            event,
            isPaintingTiles,
            isErasingTiles,
        } = params;

        this.lastDragPosition = { y: rowIndex, x: colIndex };

        if (event.button === MouseEventType.LeftClick) {
            return this.handleLeftClick(params);
        }

        if (event.button === MouseEventType.RightClick) {
            return this.handleRightClick(params);
        }

        return { isPaintingTiles, isErasingTiles };
    }

    private handleLeftClick(params: CellInteractionParams): MapSetupInteractionState {
        const { game, rowIndex, colIndex, event, activeTileTexture, activeTileItem, counts, isErasingTiles } = params;
        event.preventDefault();
        if (activeTileTexture) {
            try {
                this.applyTile({ game, rowIndex, colIndex, tileAttribute: activeTileTexture, event, counts });
                return { isPaintingTiles: true, isErasingTiles };
            } catch {
                return { isPaintingTiles: false, isErasingTiles };
            }
        } else if (activeTileItem) {
            this.applyTile({ game, rowIndex, colIndex, tileAttribute: activeTileItem, event, counts });
            return { isPaintingTiles: true, isErasingTiles };
        }
        return { isPaintingTiles: false, isErasingTiles };
    }

    private handleRightClick(params: CellInteractionParams): MapSetupInteractionState {
        const { game, rowIndex, colIndex, event, activeTileTexture, activeTileItem, counts, isPaintingTiles } = params;
        if (activeTileTexture) {
            this.deleteTile({ game, rowIndex, colIndex, tileAttribute: activeTileTexture, event, counts });
        } else if (activeTileItem) {
            this.deleteTile({ game, rowIndex, colIndex, tileAttribute: activeTileItem, event, counts });
        } else {
            const tile = game.grid[rowIndex][colIndex];
            if (event.shiftKey && tile.item) {
                this.deleteTile({ game, rowIndex, colIndex, tileAttribute: tile.item, event, counts });
            } else if (!event.shiftKey) {
                if (tile.type !== TileTexture.Floor) {
                    this.deleteTile({ game, rowIndex, colIndex, tileAttribute: TileTexture.Floor, event, counts });
                } else if (tile.item) {
                    this.deleteTile({ game, rowIndex, colIndex, tileAttribute: tile.item, event, counts });
                }
            }
        }
        return { isPaintingTiles, isErasingTiles: true };
    }

    private handleErasePath(params: {
        game: Game;
        path: Vec2[];
        event: MouseEvent;
        counts: TileItemCounts
    }): void {
        const { game, path, event, counts } = params;
        for (const cell of path) {
            try {
                if (event.shiftKey) {
                    const tile = game.grid[cell.y]?.[cell.x];
                    if (tile?.item) {
                        this.deleteTile({ game, rowIndex: cell.y, colIndex: cell.x, tileAttribute: tile.item, event, counts });
                    }
                } else {
                    this.deleteTile({ game, rowIndex: cell.y, colIndex: cell.x, tileAttribute: TileTexture.Floor, event, counts });
                }
            } catch {
                throw new Error(`Erreur avec l'évènement (mouseenter) quand on supprime en appuyant`);
            }
        }
    }

    private handlePaintPath(params: {
        game: Game;
        path: Vec2[];
        event: MouseEvent;
        activeTileTexture: TileTexture | null;
        activeTileItem: TileItem | null;
        counts: TileItemCounts;
    }): void {
        const { game, path, event, activeTileTexture, activeTileItem, counts } = params;
        for (const cell of path) {
            const gameTile = game.grid[cell.y]?.[cell.x];
            if (!gameTile) continue;

            if (activeTileTexture) {
                this.removeBlockingItemIfNeeded(game, cell.y, cell.x, activeTileTexture, counts);
                try {
                    this.applyTile({ game, rowIndex: cell.y, colIndex: cell.x, tileAttribute: activeTileTexture, event, counts });
                } catch {
                    throw new Error(`Erreur avec l'évènement (mouseenter) quand les tuiles sont activées`);
                }
            } else if (activeTileItem) {
                try {
                    this.applyTile({ game, rowIndex: cell.y, colIndex: cell.x, tileAttribute: activeTileItem, event, counts });
                } catch {
                    throw new Error(`Erreur avec l'évènement (mouseenter) quand les objects sont activés`);
                }
            }
        }
    }

    handleCellMouseEnter(params: CellInteractionParams): MapSetupInteractionState {
        const { game, rowIndex, colIndex, event, activeTileTexture, activeTileItem, counts, isPaintingTiles, isErasingTiles } = params;

        const path = this.lastDragPosition
            ? this.drawStraightLine(this.lastDragPosition.y, this.lastDragPosition.x, rowIndex, colIndex)
            : [{ y: rowIndex, x: colIndex }];

        this.lastDragPosition = { y: rowIndex, x: colIndex };

        if (isErasingTiles) {
            if (event.buttons !== MouseEventType.RightDrag) return { isPaintingTiles, isErasingTiles: false };
            this.handleErasePath({ game, path, event, counts });
            return { isPaintingTiles, isErasingTiles };
        }

        if (!isPaintingTiles) return { isPaintingTiles, isErasingTiles };
        if (event.buttons !== MouseEventType.LeftDrag) return { isPaintingTiles: false, isErasingTiles };

        this.handlePaintPath({ game, path, event, activeTileTexture, activeTileItem, counts });
        return { isPaintingTiles, isErasingTiles };
    }

    resetInteractionState(): MapSetupInteractionState {
        this.lastDragPosition = null;
        return { isPaintingTiles: false, isErasingTiles: false };
    }

    resetSelection(): MapSetupSelection {
        return { activeTileTexture: null, activeTileItem: null };
    }

    resetGrid(game: Game): void {
        game.grid.forEach((row) =>
            row.forEach((tile) => {
                tile.type = TileTexture.Floor;
                tile.item = null;
            }),
        );
    }

    resetMap(game: Game): MapSetupResetResult {
        this.resetGrid(game);
        return { itemCounts: this.tileItemCountService.createRequiredCounts(game), selection: this.resetSelection() };
    }

    private extractGridTypes(game: Game): TileTexture[][] {
        return game.grid.map((row) => row.map((tile) => tile.type));
    }

    private extractPlacedObjects(game: Game): PlacedObject[] {
        const placed: PlacedObject[] = [];
        [TileItem.HealingSanctuary, TileItem.CombatSanctuary].forEach((item) => {
            this.getSanctuaryTopLefts(game, item).forEach((p) => placed.push({ type: item, position: { x: p.x, y: p.y } }));
        });
        game.grid.forEach((row, y) => {
            row.forEach((tile, x) => {
                if (tile.item && !this.isSanctuary(tile.item)) placed.push({ type: tile.item, position: { x, y } });
            });
        });
        return placed;
    }

    buildValidationPayload(game: Game): GameDraftForValidation {
        return {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: this.extractGridTypes(game),
            placedObjects: this.extractPlacedObjects(game),
        };
    }
}
