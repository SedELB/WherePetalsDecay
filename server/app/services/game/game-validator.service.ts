import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { Tile } from '@app/model/schema/game.schema';
import { DESC_MAX_LENGTH, NAME_MAX_LENGTH, TEXT_MIN_LENGTH } from '@app/utils/game.constants';
import { GameMode, GridSizes, SanctuaryCount, TileItem, TileTexture } from '@common/enums';
import {
    COMBAT_SANCTUARIES_NOT_PLACED,
    DESC_INVALID_DOOR_PLACEMENT,
    DESC_INVALID_DOOR_PLACEMENT_2,
    DESCRIPTION_FIELD_EMPTY,
    DESCRIPTION_FIELD_TOO_LONG,
    DOOR_ON_GRID_BORDER,
    FLAG_NOT_PLACED,
    HEALING_SANCTUARIES_NOT_PLACED,
    INSUFFICIENT_TERRAIN_TILES,
    INVALID_DOOR_PLACEMENT,
    NAME_FIELD_EMPTY,
    NAME_FIELD_TOO_LONG,
    NO_TERRAIN_TILES,
    SPAWN_POINTS_NOT_PLACED,
    UNREACHABLE_TILES,
} from '@common/error-messages';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameValidatorService {

    /*
    @param property: string representing the property to count (e.g., 'type' or 'item')
    ex. returns ex. {ice: 3, floor: 40, water: 21} ** only the types/items present in the grid + {item: null} is ignored**
    */
    private countByProperty(game: CreateGameDto, property: string): Record<string, number> {
        return game.grid.flat().reduce((acc, tile) => {
            const value = tile[property]; // ex. value = tile['type'] or tile['item'] = 'ice', 'floor', etc.
            if (value) {
                acc[value] = (acc[value] ?? 0) + 1; // acc[value] starts at 0 if undefined
            }
            return acc;
        }, {});
    }

    private isTextLengthValid(game: CreateGameDto): boolean {
        const errors: string[] = [];

        if (game.name.length < TEXT_MIN_LENGTH) {
            errors.push(NAME_FIELD_EMPTY);
        } else if (game.name.length > NAME_MAX_LENGTH) {
            errors.push(NAME_FIELD_TOO_LONG);
        }

        if (game.description.length < TEXT_MIN_LENGTH) {
            errors.push(DESCRIPTION_FIELD_EMPTY);
        } else if (game.description.length > DESC_MAX_LENGTH) {
            errors.push(DESCRIPTION_FIELD_TOO_LONG);
        }
        if (errors.length > 0) {
            throw errors;
        }
        return true;
    }

    private isGameSurfaceValid(game: CreateGameDto): boolean {
        const types = this.countByProperty(game, 'type');
        const terrainTilesNumber = (types.floor || 0) + (types.ice || 0) + (types.water || 0);
        if (terrainTilesNumber > ((game.size.cols * game.size.rows) / 2)) {
            return true;
        } else {
            throw new Error(INSUFFICIENT_TERRAIN_TILES);
        }
    }

    private areAllSpawnPointsPlaced(game: CreateGameDto): boolean {
        const items = this.countByProperty(game, 'item');
        if ((items.spawn || 0) === game.maxPlayers) {
            return true;
        } else {
            throw new Error(SPAWN_POINTS_NOT_PLACED);
        }
    }

    // For areThereUnreachableTiles()
    private findFirstWalkableTile(grid: Tile[][]): Vec2 | null {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                const tile = grid[r][c];
                const isSanctuary = tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary;
                if (tile.type !== TileTexture.Wall && !isSanctuary) return { y: r, x: c };
            }
        }
        return null;
    }

    // For areThereUnreachableTiles()
    private isTileValidForPath(game: CreateGameDto, y: number, x: number, visited: Set<string>): boolean {
        const isWithinBounds = y >= 0 && y < game.grid.length && x >= 0 && x < game.grid[0].length;
        if (!isWithinBounds) return false;

        const isNotWall = game.grid[y][x].type !== TileTexture.Wall;
        const isNotVisited = !visited.has(`${y}, ${x}`);

        return isNotWall && isNotVisited;
    }

    private getSanctuaryOrigin(game: CreateGameDto, y: number, x: number): string {
        const item = game.grid[y][x].item;
        const aboveSame = y > 0 && game.grid[y - 1][x].item === item;
        const leftSame = x > 0 && game.grid[y][x - 1].item === item;
        const aboveLeftSame = y > 0 && x > 0 && game.grid[y - 1][x - 1].item === item;

        let originY = y;
        let originX = x;

        if (aboveLeftSame && aboveSame && leftSame) {
            originY = y - 1;
            originX = x - 1;
        } else if (aboveSame) {
            originY = y - 1;
        } else if (leftSame) {
            originX = x - 1;
        }

        return `${originY}, ${originX}`;
    }

    private areThereUnreachableTiles(game: CreateGameDto): boolean {
        const startPos = this.findFirstWalkableTile(game.grid);
        if (!startPos) {
            throw new Error(NO_TERRAIN_TILES);
        }

        const totalSanctuaryBlocks = this.getRequiredSanctuaryCount(game) * 2;

        const totalWalkable = game.grid.flat().filter((tile) => {
            const isSanctuary = tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary;
            return tile.type !== TileTexture.Wall && !isSanctuary;
        }).length;

        const expectedTotalReached = totalWalkable + totalSanctuaryBlocks;

        const queue = [startPos];
        const visited = new Set<string>();
        const reachedSanctuaries = new Set<string>();

        visited.add(`${startPos.y}, ${startPos.x}`);

        while (queue.length > 0) {
            const currentTile = queue.shift();
            const neighbours = [
                { y: currentTile.y - 1, x: currentTile.x }, // Up
                { y: currentTile.y + 1, x: currentTile.x }, // Down
                { y: currentTile.y, x: currentTile.x - 1 }, // Left
                { y: currentTile.y, x: currentTile.x + 1 },  // Right
            ];

            for (const next of neighbours) {
                const key = `${next.y}, ${next.x}`;
                if (this.isTileValidForPath(game, next.y, next.x, visited)) {
                    const nextTile = game.grid[next.y][next.x];
                    const isSanctuary = nextTile.item === TileItem.HealingSanctuary || nextTile.item === TileItem.CombatSanctuary;

                    if (isSanctuary) {
                        const origin = this.getSanctuaryOrigin(game, next.y, next.x);
                        reachedSanctuaries.add(`${nextTile.item}-${origin}`);
                    } else {
                        visited.add(key);
                        queue.push(next);
                    }
                }
            }
        }

        const totalReached = visited.size + reachedSanctuaries.size;

        if (totalReached >= expectedTotalReached) {
            return true;
        } else {
            throw new Error(UNREACHABLE_TILES);
        }
    }

    // For isDoorsPlacementValid()
    private isDoorOnGridBorder(grid: Tile[][], y: number, x: number): boolean {
        const rows = grid.length;
        const cols = grid[0].length;
        const isInside =
            y > 0 &&
            y < rows - 1 &&
            x > 0 &&
            x < cols - 1;

        if (isInside) return true;
        return false;
    }
    private countSanctuaryBlocks(game: CreateGameDto, item: TileItem): number {
        let count = 0;
        for (let y = 0; y < game.grid.length; y++) {
            for (let x = 0; x < game.grid[y].length; x++) {
                if (game.grid[y][x].item === item) {
                    const aboveHasSame = game.grid[y - 1]?.[x]?.item === item;
                    const leftHasSame = game.grid[y]?.[x - 1]?.item === item;
                    if (!aboveHasSame && !leftHasSame) count++;
                }
            }
        }
        return count;
    }
    private getRequiredSanctuaryCount(game: CreateGameDto): number {
        if (game.size.rows === GridSizes.Small) return SanctuaryCount.Small;
        if (game.size.rows === GridSizes.Medium) return SanctuaryCount.Medium;
        return SanctuaryCount.Large;
    }
    private areSanctuariesValid(game: CreateGameDto): boolean {
        const errors: string[] = [];
        const required = this.getRequiredSanctuaryCount(game);
        const healingCount = this.countSanctuaryBlocks(game, TileItem.HealingSanctuary);
        if (healingCount !== required)
            errors.push(HEALING_SANCTUARIES_NOT_PLACED);
        const combatCount = this.countSanctuaryBlocks(game, TileItem.CombatSanctuary);
        if (combatCount !== required)
            errors.push(COMBAT_SANCTUARIES_NOT_PLACED);
        if (errors.length > 0) throw errors;
        return true;
    }

    // For type and item
    private getObjectsPositions(game: CreateGameDto, wantedObject: string): Vec2[] {
        if (game.grid.length === 0) return [];

        const objectPositions: Vec2[] = [];

        for (let i = 0; i < game.grid.length; i++) {
            for (let j = 0; j < game.grid[0].length; j++) {
                const currentTile = game.grid[i][j];
                // includes to cover both type of doors
                if (currentTile.type.includes(wantedObject) || currentTile.item === wantedObject) {
                    objectPositions.push({ y: i, x: j });
                }
            }
        }
        return objectPositions;
    }

    private isDoorsPlacementValid(game: CreateGameDto): boolean {
        const allDoorsPos = this.getObjectsPositions(game, 'door');
        const errors: string[] = [];
        const wall = TileTexture.Wall;
        const obstacles = [wall, TileTexture.DoorOpened, TileTexture.DoorClosed];

        for (const { y: row, x: col } of allDoorsPos) {
            // Grid border is excluded
            if (!this.isDoorOnGridBorder(game.grid, row, col)) {
                errors.push(`La porte à la position (${row}, ${col}) ${DOOR_ON_GRID_BORDER}`);
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

            if (verticalSandwich && horizontalSandwich) {
                errors.push(`${INVALID_DOOR_PLACEMENT} (${row}, ${col}) : ${DESC_INVALID_DOOR_PLACEMENT}`);
            }
            if (!verticalSandwich && !horizontalSandwich) {
                errors.push(`${INVALID_DOOR_PLACEMENT} (${row}, ${col}) : ${DESC_INVALID_DOOR_PLACEMENT_2}`);
            }

        }
        if (errors.length > 0) throw errors;
        return true;
    }

    private isFlagPlaced(game: CreateGameDto): boolean {
        if (game.gameMode === GameMode.Ctf) {
            const nbFlag = this.countByProperty(game, 'item').flag || 0;
            if (nbFlag === 0) {
                throw new Error(FLAG_NOT_PLACED);
            }
            return true; // has been placed
        }
        return false; // Case : gameMode = classic
    }

    isGameValid(game: CreateGameDto): boolean {
        let errors: string[] = [];

        const validations = [
            () => this.isTextLengthValid(game),
            () => this.isDoorsPlacementValid(game),
            () => this.areThereUnreachableTiles(game),
            () => this.isGameSurfaceValid(game),
            () => this.areAllSpawnPointsPlaced(game),
            () => this.isFlagPlaced(game),
            () => this.areSanctuariesValid(game),
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
            throw new Error(`${errors.join('\n- ')}`);
        }
        return true;
    }
}
