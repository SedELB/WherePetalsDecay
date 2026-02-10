import { TEXT_MIN_LENGTH, NAME_MAX_LENGTH, DESC_MAX_LENGTH, MAX_PLAYERS } from '@app/utils/game.constants';
import { GameMode, TileTexture, TileItem } from '@app/utils/game.enum';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { Tile } from '@app/model/schema/game.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameValidatorService {

    /*
    @param property: string representing the property to count (e.g., 'type' or 'item')
    ex. returns ex. {ice: 3, floor: 40, water: 21} ** only the types/items present in the grid + {item: null} is ignored**
    */
    countByProperty(game: CreateGameDto, property: string): Record<string, number> {
        return game.grid.flat().reduce((acc, tile) => {
            const value = tile[property]; // ex. value = tile['type'] or tile['item'] = 'ice', 'floor', etc.
            if (value) {
                acc[value] = (acc[value] ?? 0) + 1; // acc[value] starts at 0 if undefined
            }
            return acc;
        }, {});
    }

    generateInvalidGrid(rows: number, cols: number): Tile[][] {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, (): Tile => ({ type: TileTexture.Wall, item: null })),  // Tout en murs = invalide
        );
    }

    generateValidGrid(rows: number, cols: number): Tile[][] {
        const grid: Tile[][] = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, (): Tile => ({ type: TileTexture.Floor, item: null })),
        );

        // Places random walls at 30% rate
        // for (let i = 0; i < rows; i++) {
        //     for (let j = 0; j < cols; j++) {
        //         if (Math.random() < 0.3) grid[i][j].type = TileTexture.Wall;
        //     }
        // }

        let spawnCount = 0;
        while (spawnCount < MAX_PLAYERS) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);
            if (grid[r][c].type !== TileTexture.Wall && !grid[r][c].item) {
                grid[r][c].item = TileItem.Spawn;
                spawnCount++;
            }
        }

        return grid;
    }

    isTextLengthValid(game: CreateGameDto): boolean {
        const errors: string[] = [];

        if (game.name.length < TEXT_MIN_LENGTH) {
            errors.push('The name field is empty!');
        } else if (game.name.length > NAME_MAX_LENGTH) {
            errors.push('The name field exceeds the maximum length!');
        }

        if (game.description.length < TEXT_MIN_LENGTH) {
            errors.push('The description field is empty!');
        } else if (game.description.length > DESC_MAX_LENGTH) {
            errors.push('The description field exceeds the maximum length!');
        }
        if (errors.length > 0) {
            throw new Error(JSON.stringify(errors));  // TODO: has to be validate
        }
        return true;
    }
    
    isGameSurfaceValid(game: CreateGameDto): boolean {
        const types = this.countByProperty(game, 'type');
        const terrainTilesNumber = (types.floor || 0) + (types.ice || 0) + (types.water || 0);
        if (terrainTilesNumber > ((game.size.cols * game.size.rows) / 2)) {
            return true;
        } else {
            throw new Error('Less than 50% of tiles are walkable!');
        }
    }

    areAllSpawnPointsPlaced(game: CreateGameDto): boolean {
        const items = this.countByProperty(game, 'item');
        if ((items.spawn || 0) === game.maxPlayers) {
            return true;
        } else {
            throw new Error('Not all spawn points are placed!');
        }
    }   

    // For areThereUnreachableTiles()
    findFirstWalkableTile(grid: Tile[][]): { row: number; col: number } | null {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c].type !== TileTexture.Wall) return { row: r, col: c };
            }
        }
        return null;
    }   
    
    // For areThereUnreachableTiles()
    isTileValidForPath(game: CreateGameDto, row: number, col: number, visited: Set<string>): boolean {
        const isWithinBounds = row >= 0 && row < game.grid.length && col >= 0 && col < game.grid[0].length;
        if (!isWithinBounds) return false;

        const isNotWall = game.grid[row][col].type !== TileTexture.Wall;
        const isNotVisited = !visited.has(`${row}, ${col}`);
        
        return isNotWall && isNotVisited;
    }

    areThereUnreachableTiles(game: CreateGameDto): boolean {
        const startPos = this.findFirstWalkableTile(game.grid);
        if (!startPos) {
            throw new Error('There are no walkable tiles!');
        }

        const types = this.countByProperty(game, 'type');
        const totalWalkable = (types.floor || 0) + (types.water || 0) + (types.ice || 0) + 
                            (types.doorOpened || 0) + (types.doorClosed || 0); // Door and terrain

        const queue = [startPos];
        const visited = new Set<string>();
        visited.add(`${startPos.row}, ${startPos.col}`);

        while (queue.length > 0) {
            const currentTile = queue.shift();
            const neighbours = [
                { row: currentTile.row - 1, col: currentTile.col }, // Up
                { row: currentTile.row + 1, col: currentTile.col }, // Down
                { row: currentTile.row, col: currentTile.col - 1 }, // Left
                { row: currentTile.row, col: currentTile.col + 1 },  // Right
            ];

            for (const next of neighbours) {
                const key = `${next.row}, ${next.col}`; // text name of current tile
                if (this.isTileValidForPath(game, next.row, next.col, visited)) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }

        if (visited.size === totalWalkable) {
            return true;
        } else {
            throw new Error('One or more tiles are unreachable!');
        }
    }

    // For isDoorsPlacementValid()
    isDoorOnGridBorder(grid: Tile[][], row: number, col: number): boolean {
        const rows = grid.length;
        const cols = grid[0].length;
        const isInside =
            row > 0 &&
            row < rows - 1 &&
            col > 0 &&
            col < cols - 1;
        
        if (isInside) return false;
        return true;
    }

    // For type and item
    getObjectsPositions(game: CreateGameDto, wantedObject: string): { row: number; col: number }[] {
        if (game.grid.length === 0) return [];

        const objectPositions: { row: number; col: number }[] = [];

        for (let i = 0; i < game.grid.length; i++) {
            for (let j = 0; j < game.grid[0].length; j++) {
                const currentTile = game.grid[i][j];
                // includes to cover both type of doors
                if (currentTile.type.includes(wantedObject) || currentTile.item === wantedObject) {
                    objectPositions.push({ row: i, col: j });
                }
            }
        }
        return objectPositions;
    }

    isDoorsPlacementValid(game: CreateGameDto): boolean {
        const allDoorsPos = this.getObjectsPositions(game, 'door');
        const errors: string[] = [];
        const wall = TileTexture.Wall;
        const obstacles = [wall, TileTexture.DoorOpened, TileTexture.DoorClosed];

        for (const { row, col } of allDoorsPos) {
            // Grid border is excluded
            if (this.isDoorOnGridBorder(game.grid, row, col)) {
                errors.push(`Door at (${row}, ${col}) cannot be on the edge of the map!`);
                continue;
            }

            const up = game.grid[row - 1][col].type;
            const down = game.grid[row + 1][col].type;
            const left = game.grid[row][col - 1].type;
            const right = game.grid[row][col + 1].type;

            const verticalSandwich = (up === wall && down === wall) && 
                                    (!obstacles.includes(left) && !obstacles.includes(right));

            const horizontalSandwich = (left === wall && right === wall) && 
                                    (!obstacles.includes(up) && !obstacles.includes(down));

            if (!verticalSandwich && !horizontalSandwich) {
                errors.push(`Invalid door placement at the position (${row}, ${col})! (missing walls)`);
            }
        }
        if (errors.length > 0) throw new Error(JSON.stringify(errors));
        return true;
    }

    isFlagPlaced(game: CreateGameDto): boolean {
        if (game.gameMode === GameMode.Ctf) {
            const nbFlag = this.countByProperty(game, 'item').flag || 0;
            if (nbFlag === 0) {
                throw new Error("The Flag isn't placed!");
            }
            return true; // has been placed
        }
        return false; // Case : gameMode = classic
    }

    isGameValid(game: CreateGameDto): boolean {
        let errors: string[] = [];

        const validations = [
            () => this.isTextLengthValid(game),
            () => this.areThereUnreachableTiles(game),
            () => this.isGameSurfaceValid(game),
            () => this.areAllSpawnPointsPlaced(game),
            () => this.isDoorsPlacementValid(game),
            () => this.isFlagPlaced(game),
        ];
        
        for (const validation of validations) {
            try {
                validation();
            } catch (error) {
                if (error instanceof Error) {
                    errors.push(error.message);
                } else {
                    errors = errors.concat(error);
                }
            }
        }
        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join('; ')}`);
        }
        return true;
    }
}