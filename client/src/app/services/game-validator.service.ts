import { Injectable } from '@angular/core';
import { PlacedObject } from '@app/interfaces/game';
import { TileItem, TileTexture } from '@common/enums';

const NAME_MAX_LENGTH = 20;
const DESC_MAX_LENGTH = 500;
const TEXT_MIN_LENGTH = 1;

export interface GameValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface GameDraftForValidation {
    id?: string;
    name: string;
    description: string;
    mode: string;
    size: { rows: number; cols: number };
    grid: TileTexture[][];
    placedObjects: PlacedObject[];
    existingNames?: string[];
}

@Injectable({
    providedIn: 'root',
})
export class GameValidatorService {
    validate(draft: GameDraftForValidation): GameValidationResult {
        const errors: string[] = [];

        if (draft.existingNames && draft.existingNames.includes(draft.name) && (!draft.id || draft.name !== draft.id)) {
            errors.push('The name of the game is not unique!');
        }

        errors.push(...this.validateTextLength(draft.name, draft.description));

        errors.push(...this.validateDoorsPlacement(draft.grid));

        errors.push(...this.validateReachability(draft.grid));

        errors.push(...this.validateSurface(draft.grid));

        errors.push(...this.validateSpawnPoints(draft.size, draft.placedObjects));

        errors.push(...this.validateFlagPlaced(draft.mode, draft.placedObjects));

        return { isValid: errors.length === 0, errors };
    }

    private validateTextLength(name: string, description: string): string[] {
        const errors: string[] = [];

        if ((name ?? '').length < TEXT_MIN_LENGTH) {
            errors.push('The name field is empty!');
        } else if (name.length > NAME_MAX_LENGTH) {
            errors.push('The name field exceeds the maximum length!');
        }

        if ((description ?? '').length < TEXT_MIN_LENGTH) {
            errors.push('The description field is empty!');
        } else if (description.length > DESC_MAX_LENGTH) {
            errors.push('The description field exceeds the maximum length!');
        }

        return errors;
    }

    private validateSurface(grid: TileTexture[][]): string[] {
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;
        if (rows === 0 || cols === 0) return ['Grid is empty!'];

        const terrain = new Set<TileTexture>([TileTexture.Floor, TileTexture.Ice, TileTexture.Water]);
        let terrainCount = 0;
        for (const row of grid) {
            for (const tileType of row) {
                if (terrain.has(tileType)) terrainCount++;
            }
        }

        if (terrainCount > (rows * cols) / 2) return [];
        return ['Less than 50% of tiles are walkable!'];
    }

    private validateSpawnPoints(size: { rows: number; cols: number }, placedObjects: PlacedObject[]): string[] {
        const maxPlayers = this.getMaxPlayers(size);
        const spawns = placedObjects.filter((o) => o.type === TileItem.Spawn).length;
        if (spawns === maxPlayers) return [];
        return ['Not all spawn points are placed!'];
    }

    private validateFlagPlaced(mode: string, placedObjects: PlacedObject[]): string[] {
        if (mode !== 'ctf') return [];
        const flags = placedObjects.filter((o) => o.type === TileItem.Flag).length;
        if (flags > 0) return [];
        return ["The Flag isn't placed!"];
    }

    private validateReachability(grid: TileTexture[][]): string[] {
        const start = this.findFirstWalkableTile(grid);
        if (!start) return ['There are no walkable tiles!'];

        const totalWalkable = this.countWalkableTiles(grid);

        const queue: Array<{ row: number; col: number }> = [start];
        const visited = new Set<string>([`${start.row},${start.col}`]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) break;

            const neighbours = [
                { row: current.row - 1, col: current.col },
                { row: current.row + 1, col: current.col },
                { row: current.row, col: current.col - 1 },
                { row: current.row, col: current.col + 1 },
            ];

            for (const next of neighbours) {
                const key = `${next.row},${next.col}`;
                if (this.isTileValidForPath(grid, next.row, next.col, visited)) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }

        if (visited.size === totalWalkable) return [];
        return ['Une ou plusieurs tuiles sont inaccessibles !'];
    }

    private findFirstWalkableTile(grid: TileTexture[][]): { row: number; col: number } | null {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c] !== TileTexture.Wall) return { row: r, col: c };
            }
        }
        return null;
    }

    private isTileValidForPath(grid: TileTexture[][], row: number, col: number, visited: Set<string>): boolean {
        const isWithinBounds = row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length ?? 0);
        if (!isWithinBounds) return false;

        const isNotWall = grid[row][col] !== TileTexture.Wall;
        const isNotVisited = !visited.has(`${row},${col}`);
        return isNotWall && isNotVisited;
    }

    private countWalkableTiles(grid: TileTexture[][]): number {
        const walkable = new Set<TileTexture>([TileTexture.Floor, TileTexture.Water, TileTexture.Ice, TileTexture.DoorOpened, TileTexture.DoorClosed]);
        let count = 0;
        for (const row of grid) {
            for (const tileType of row) {
                if (walkable.has(tileType)) count++;
            }
        }
        return count;
    }

    private validateDoorsPlacement(grid: TileTexture[][]): string[] {
        const errors: string[] = [];
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;
        if (rows === 0 || cols === 0) return errors;

        const doors: Array<{ row: number; col: number }> = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const type = grid[r][c];
                if (type === TileTexture.DoorOpened || type === TileTexture.DoorClosed) {
                    doors.push({ row: r, col: c });
                }
            }
        }

        const obstacles = new Set<TileTexture>([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed]);

        for (const { row, col } of doors) {
            // Porte ne peut etre sur le bord de la map
            const isInside = row > 0 && row < rows - 1 && col > 0 && col < cols - 1;
            if (!isInside) {
                errors.push(`Door at (${row}, ${col}) cannot be on the edge of the map!`);
                continue;
            }

            const up = grid[row - 1][col];
            const down = grid[row + 1][col];
            const left = grid[row][col - 1];
            const right = grid[row][col + 1];

            const verticalSandwich = up === TileTexture.Wall && down === TileTexture.Wall && !obstacles.has(left) && !obstacles.has(right);
            const horizontalSandwich = left === TileTexture.Wall && right === TileTexture.Wall && !obstacles.has(up) && !obstacles.has(down);

            if (!verticalSandwich && !horizontalSandwich) {
                errors.push(`Invalid door placement at the position (${row}, ${col})!`);
            }
        }

        return errors;
    }

    private getMaxPlayers(size: { rows: number; cols: number }): number {
        const maxDim = Math.max(size.rows, size.cols);
        if (maxDim <= 10) return 2;
        if (maxDim <= 15) return 4;
        return 6;
    }
}

