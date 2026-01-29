import { TileItem, TileTexture } from '@app/model/schema/game.constants';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GameValidatorService {
    constructor(@InjectModel(Game.name) private gameModel: Model<GameDocument>) {}

    /*
    @param property: string representing the property to count (e.g., 'type' or 'item')
    ex. returns ex. {ice: 3, floor: 40, water: 21}
    */
    countByProperty(game: Game, property: string): Record<string, number> {
        return game.grid.flat().reduce((acc, tile) => {
            const value = tile[property]; // ex. value = tile['type'] or tile['item'] = 'ice', 'floor', etc.
            if (value) {
                acc[value] = (acc[value] ?? 0) + 1; // acc[value] starts at 0 if undefined
            }
            return acc;
        }, {});
    }

    // Uniquement pour type et item (pas DoorState)
    getTilePosition(game: Game, wantedTile: string): { row: number; col: number }[] {
        const tilePositions: { row: number; col: number }[] = [];

        for (let i = 0; i < game.grid.length; i++) {
            for (let j = 0; j < game.grid[0].length; j++) {
                if (Object.values(TileTexture).includes(wantedTile as TileTexture) &&
                    game.grid[i][j].type === wantedTile) {
                    tilePositions.push({ row: i, col: j });
                } else if (Object.values(TileItem).includes(wantedTile as TileItem) &&
                    game.grid[i][j].item === wantedTile) {
                    tilePositions.push({ row: i, col: j });
                }
            }
        }
        return tilePositions;
    }

    async isGameNameUnique(gameName: string): Promise<boolean> {
        const nameExists = await this.gameModel.findOne({ name: gameName });
        if (nameExists){
            return true;
        } else {
            throw new Error('The name of the game is not unique!');
        }
    }

    isGameSurfaceValid(game: Game): boolean {
        const types = this.countByProperty(game, 'type');
        const terrainTilesNumber = (types.floor || 0) + (types.ice || 0) + (types.water || 0);
        if (terrainTilesNumber > ((game.size.cols * game.size.rows) / 2)) {
            return true;
        } else {
            throw new Error('Less than 50% of tiles are walkable!');
            // return false;
        }
    }

    areAllSpawnPointsPlaced(game: Game): boolean {
        const items = this.countByProperty(game, 'item');
        if ((items.start || 0) === game.maxPlayers) {
            return true;
        } else {
            throw new Error('Not all spawn points are placed!');
            // return false;
        }
    }

    areThereUnreachableTiles(game: Game): boolean {
        let startPos = null;
        for (let r = 0; r < game.grid.length; r++) {
            for (let c = 0; c < game.grid[r].length; c++) {
                if (game.grid[r][c].type !== 'wall') {
                    startPos = { row: r, col: c };
                    break;
                }
            }
            if (startPos) break;
        }

        const types = this.countByProperty(game, 'type');
        const totalWalkable = types.floor + types.water + types.ice;
        const queue = [startPos];
        const visited = new Set();
        visited.add(`${startPos.r}, ${startPos.c}`);

        while (queue.length > 0) {
            const currentTile = queue.shift();
            const neighbours = [
                { r: currentTile.row - 1, c: currentTile.col }, // Up
                { r: currentTile.row + 1, c: currentTile.col }, // Down
                { r: currentTile.row, c: currentTile.col - 1 }, // Left
                { r: currentTile.row, c: currentTile.col + 1 },  // Right
            ];

            for (const next of neighbours) {
                const key = `${next.r}, ${next.c}`; // text name of current tile
                if (
                    next.r >= 0 && next.r < game.grid.length &&
                    next.c >= 0 && next.c < game.grid[0].length &&
                    game.grid[next.r][next.c].type !== 'wall' &&
                    !visited.has(key)
                ) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }

        if (visited.size === totalWalkable) {
            return true;
        } else {
            throw new Error('Une ou plusieurs tuiles sont inaccessibles !');
            // return false;
        }
    }

    isDoorPlacementValid(game: Game): boolean {
        const allDoorsPos = this.getTilePosition(game, 'door');
        for (const { row, col } of allDoorsPos) {

            const rows = game.grid.length;
            const cols = game.grid[0].length;

            const isInsideGrid =
                row > 0 &&
                row < rows - 1 &&
                col > 0 &&
                col < cols - 1;

            if (!isInsideGrid) {
                throw new Error('Invalid door placement (outside grid)!');
                // return false;
            }

            const up = game.grid[row - 1][col];
            const down = game.grid[row + 1][col];
            const left = game.grid[row][col - 1];
            const right = game.grid[row][col + 1];

            // S'il y a deux portes dans un des axes
            if ((up.type === 'wall' && down.type === 'wall') || (
                left.type === 'wall' && right.type === 'wall')) {

                // S'il y a une 3e porte
                if (left.type === 'wall' || right.type === 'wall' ||
                    up.type === 'wall' || down.type === 'wall') {
                    return false;
                }
                return true;
            }
            
            throw new Error('Invalid door placement!');
            // return false;
        }
    }

    isGameValid(game: Game): boolean {
        const errors: string[] = [];
        try {
            this.isGameNameUnique(game.name);
        } catch (error) {
            errors.push(error.message);
        }

        try {
            this.isDoorPlacementValid(game);
        } catch (error) {
            errors.push(error.message);
        }

        try {
        this.areThereUnreachableTiles(game);
        } catch (error) {
            errors.push(error.message);
        }

        try {
            this.isGameSurfaceValid(game);
        } catch (error) {
            errors.push(error.message);
        }

        try {
            this.areAllSpawnPointsPlaced(game);
        } catch (error) {
            errors.push(error.message);
        }

        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join('; ')}`);
        }

        return true;
    }
}