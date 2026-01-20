import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game } from '../../model/schema/game.schema';

// Schema = template du document
// Model = objet que Mongoose cree et qui permet linteraction avec mongodb ex. find()
// represente la collection de Game

@Injectable()
export class GameService {
    constructor(@InjectModel("Game") private gameModel: Model<Game>) {}

    async getAllGames(): Promise<Game[]> {
        return await this.gameModel.find().exec();
    }

    async getGameById(id: string): Promise<Game> {
        return await this.gameModel.findOne({id: id}).exec();
    }
}

