import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game, GameDocument } from '@app/model/schema/game.schema';

@Injectable()
export class GameValidatorService {
    constructor(@InjectModel(Game.name) private gameModel: Model<GameDocument>) {}

    /*
    Tile.type returns a TileType (floor, ice, etc.)
    property: [type, item, doorState]
    returns: occ = {property: no. of occurence}
    ex. {ice: 3, floor: 40, water: 21}
    */
    countByProperty(game: Game, property: string): Record<string, number>{
        const occ = game.grid.flat().reduce((acc, currentObject) => {
            const type = currentObject[property]; // currentObject: Tile
            if (type !== undefined && type !== null) acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        return occ;
    }

    async isGameNameUnique(gameName: string): Promise<boolean> {
        const nameExists = await this.gameModel.findOne({name: gameName});
        return !nameExists;
    }

    isGameSurfaceValid(game: Game): boolean {
        const types = this.countByProperty(game, 'type');
        const terrainTilesNumber = (types.floor || 0) + (types.ice || 0) + (types.water || 0);
        if (terrainTilesNumber >= ((game.size.cols * game.size.rows) / 2)) {
            return true;
        } else {
            return false;
        }
    }

    areAllSpawnPointsPlaced(game: Game): boolean {
        const items = this.countByProperty(game, 'item');
        if ((items.start || 0) === game.maxPlayers) {
            return true;
        } else {
            return false;
        }
    }

    areThereInacessibleTiles(game: Game): boolean {
        let startPos = null;
        for (let r = 0; r < game.grid.length; r++){
            for (let c = 0; c < game.grid[r].length; c++){
                if (game.grid[r][c].type !== 'wall'){
                    startPos = {row: r, col: c};
                    break;
                }
            }
            if (startPos) break;
        }

        const totalWalkable = this.countByProperty(game, 'item').floor;
        const queue = [startPos];
        const visited = new Set();
        visited.add(`${startPos.r}, ${startPos.c}`);

        while (queue.length > 0){
            const currentTile = queue.shift();
            const neighbours = [
                {r: currentTile.row - 1, c: currentTile.col}, // Up
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

        if (visited.size !== totalWalkable) {
            return true;
        } else {
            return false;
        }
    }
}