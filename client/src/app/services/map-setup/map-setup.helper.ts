import { TileItem, TileTexture } from '@common/enums';
import { Game } from '@common/game';
import { Vec2 } from '@common/vec2';

// Bresenham Algorithm
export function drawStraightLine(startRow: number, startCol: number, endRow: number, endCol: number): Vec2[] {
    const path: Vec2[] = [];
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const rowDirection = startRow < endRow ? 1 : -1;
    const colDirection = startCol < endCol ? 1 : -1;

    let row = startRow;
    let col = startCol;
    let error = dx - dy;

    while (row !== endRow || col !== endCol) {
        path.push({ y: row, x: col });
        const secondError = error * 2;

        if (secondError > -dy) {
            error -= dy;
            col += colDirection;
        }
        if (secondError < dx) {
            error += dx;
            row += rowDirection;
        }
    }
    path.push({ y: endRow, x: endCol });
    return path;
}

export function inverseDoor(oldType: TileTexture): TileTexture {
    if (oldType === TileTexture.DoorClosed) return TileTexture.DoorOpened;
    if (oldType === TileTexture.DoorOpened) return TileTexture.DoorClosed;
    return TileTexture.DoorClosed;
}

export function isSanctuary(item: TileItem): boolean {
    return item === TileItem.HealingSanctuary || item === TileItem.CombatSanctuary;
}

export function canPlaceSanctuary(game: Game, rowIndex: number, colIndex: number): boolean {
    const rows = game.grid.length;
    const cols = game.grid[0]?.length ?? 0;
    if (rowIndex + 1 >= rows || colIndex + 1 >= cols) return false;

    const cells = [
        game.grid[rowIndex][colIndex],
        game.grid[rowIndex][colIndex + 1],
        game.grid[rowIndex + 1][colIndex],
        game.grid[rowIndex + 1][colIndex + 1],
    ];
    return cells.every((tile) => tile.type === TileTexture.Floor && tile.item === null);
}

export function findSanctuaryTopLeft(game: Game, rowIndex: number, colIndex: number, item: TileItem): Vec2 {
    let r = rowIndex;
    let c = colIndex;
    if (r > 0 && game.grid[r - 1]?.[c]?.item === item) r--;
    if (c > 0 && game.grid[r]?.[c - 1]?.item === item) c--;
    return { y: r, x: c };
}
