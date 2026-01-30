import { TEXT_MIN_LENGTH } from '@app/utils/game.constants';
import { TileItem, TileTexture } from '@app/utils/game.enum';
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

    // Pour type et item
    getTilePosition(game: Game, wantedTile: string): { row: number; col: number }[] {
        const tilePositions: { row: number; col: number }[] = [];

        for (let i = 0; i < game.grid.length; i++) {
            for (let j = 0; j < game.grid[0].length; j++) {
                const currentTile = game.grid[i][j];

                if (Object.values(TileTexture).includes(wantedTile as TileTexture) &&
                    currentTile.type === wantedTile) {
                    tilePositions.push({ row: i, col: j });
                } else if (Object.values(TileItem).includes(wantedTile as TileItem) &&
                    currentTile.item === wantedTile) {
                    tilePositions.push({ row: i, col: j });
                }
            }
        }
        return tilePositions;
    }

    async isGameNameUnique(gameName: string): Promise<boolean> {
        const nameExists = await this.gameModel.findOne({ name: gameName }).exec();
        if (!nameExists){
            return true;
        } else {
            throw new Error('The name of the game is not unique!'); // A voir si cest ca qui fait crash le serv (mettre promise.reject)
        }
    }

    isTextLenghtValid(game: Game): boolean {
        if (game.name.length < TEXT_MIN_LENGTH && game.description.length < TEXT_MIN_LENGTH) {
            throw new Error('The name and the description field are empty!');
            // return false;
        }

        if (game.name.length < TEXT_MIN_LENGTH) {
            throw new Error('The name field is empty!');
            // return false;
        }
        
        if (game.description.length < TEXT_MIN_LENGTH) {
            throw new Error('The description field is empty.');
            // return false;
        }
        return true;
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

    isFlagPlaced(game: Game): boolean {
        if (game.gameMode === 'ctf') {
            const nbFlag = this.countByProperty(game, 'item').flag;
            if (nbFlag === 0) {
                throw new Error("The Flag isn't placed!");
                // return false;
            }
            return true; // il a été placé
        }
        return true; // Cas : gameMode = classic
    }

    isGameValid(game: Game): boolean {
        const errors: string[] = [];
        try {
            this.isGameNameUnique(game.name);
        } catch (error) {
            errors.push(error.message);
        }

        try {
            this.isTextLenghtValid(game);
        } catch (error) {
            error.push(error.message);
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

        try {
            this.isFlagPlaced(game);
        } catch (error) {
            errors.push(error.message);
        }

        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join('; ')}`);
        }

        return true;
    }
}