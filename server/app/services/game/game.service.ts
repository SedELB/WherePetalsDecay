import { Model } from 'mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';


@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
        private readonly logger: Logger,
    ) {
        this.start();
    }

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
                grid: Array(10).fill(null).map(() => Array(10).fill({type: 'floor'})),
                isVisible: false,
            },
        ];
        this.logger.log('THIS ADDS DATA TO THE DATABASE, DO NOT USE OTHERWISE');
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

