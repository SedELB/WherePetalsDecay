import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game } from '@app/model/schema/game.schema';

/* Schema = template du document
  Model = objet Collection que Mongoose cree et qui permet linteraction avec mongodb ex. find()

*/

@Injectable()
export class GameService {
    constructor(@InjectModel('Game') private gameModel: Model<Game>) {}

    async getAllGames(): Promise<Game[]> {
        return await this.gameModel.find().exec();
    }

    async getGameById(wantedId: string): Promise<Game> {
        return await this.gameModel.findOne({id: wantedId}).exec();
    }

    async addGame() {

    }
}

