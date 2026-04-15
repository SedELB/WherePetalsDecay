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
    const visited = new Set<string>();
    for (let y = 0; y < game.grid.length; y++) {
        for (let x = 0; x < game.grid[y].length; x++) {
            if (game.grid[y][x].item === item && !visited.has(`${y},${x}`)) {
                visited.add(`${y},${x}`);
                visited.add(`${y},${x + 1}`);
                visited.add(`${y + 1},${x}`);
                visited.add(`${y + 1},${x + 1}`);
                
                if (
                    (rowIndex === y && colIndex === x) ||
                    (rowIndex === y && colIndex === x + 1) ||
                    (rowIndex === y + 1 && colIndex === x) ||
                    (rowIndex === y + 1 && colIndex === x + 1)
                ) {
                    return { y, x };
                }
            }
        }
    }
    return { y: rowIndex, x: colIndex };
}
