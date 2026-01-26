import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game } from '@app/model/schema/game.schema';

@Injectable()
export class GameValidatorService {
    constructor(@InjectModel(Game.name) private gameModel: Model<Game>) {}

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
        const nameExists = await this.gameModel.findOne({name: gameName}) !== null;
        if (!nameExists) return true;
    }

    isGameSurfaceValid(game: Game): boolean {
        const items = this.countByProperty(game, 'item');
        const terrainTilesNumber = items.floor + items.ice + items.water;
        if (terrainTilesNumber >= ((game.size.cols * game.size.rows) / 2)) {
            return true;
        } else {
            return false;
        }
    }

    areAllSpawnPointsPlaced(game: Game): boolean {
        const items = this.countByProperty(game, 'item');
        if (items.start === game.maxPlayers) {
            return true;
        } else {
            return false;
        }
    }


}