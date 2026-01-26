import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game } from '@app/model/schema/game.schema';


@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<Game>,
    ) {}

    async start() {
        if ((await this.gameModel.countDocuments()) === 0) {
            await this.populateDB();
        }
    }

    async populateDB(): Promise<void> {
        const defaultGames: CreateGameDto[] = [
            {
                name: 'BakaJanaino',
                description: 'BakaJanainoSaadSama',
                size: {rows: 10, cols: 10},
                gameMode: 'classic',
                thumbnail: 'hello',
                maxPlayers: 6,
                grid:[
                    [{type:'floor', item: undefined, doorState: undefined}],
                    ],
                
                isVisible: false,
            },
        ];
        await this.gameModel.insertMany(defaultGames);
    }

    async getAllGames(): Promise<Game[]> {
        return await this.gameModel.find().exec();
    }

    async getGameById(wantedId: string): Promise<Game> {
        return await this.gameModel.findOne({id: wantedId}).exec();
    }

//     async addGame() {
// }
}

