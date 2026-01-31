import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameMode } from '@app/utils/game.enum';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameValidatorService } from './gameValidator.service';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
const TEN = 10; // TODO: delete later

@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
        private readonly logger: Logger,
        private readonly gameValidatorService: GameValidatorService,
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
                gameMode: GameMode.Classic,
                thumbnail: 'hello',
                maxPlayers: 6,
                grid: Array(TEN).fill(null).map(() => Array(TEN).fill({type: 'floor'})),
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
        return await this.gameModel.findById(wantedId).exec();
    }

    async addGame(game: CreateGameDto): Promise<void> {
        try {
            await this.gameValidatorService.isGameValid(game);
            await this.gameModel.create(game);
        } catch (error) {
            this.logger.log(`Failed to create game: ${error.message}`);
            throw new Error(`Failed to create game: ${error.message}`);
            // return Promise.reject(`Failed to create game: ${error.message}`);
        }
    }

    async modifyGame(id: string, game: UpdateGameDto): Promise<void> {
        try {
            const existingGame = await this.gameModel.findById(id).lean(); // TODO: Has _id: can cause crash when calling isGameValid
            if (!existingGame) {
                throw new Error('No game found with this id');
            }
            const fullGameData = {...existingGame, ...game}; // new properies from game replace the olds

            await this.gameValidatorService.isGameValid(fullGameData, id);
            await this.gameModel.findByIdAndUpdate(id, game, { new: true }).exec();
        } catch (error) {
            this.logger.error(`Failed to update game: ${error.message}`);
            throw new Error(`Failed to update game: ${error.message}`);
        }
    }

    async deleteGame(id: string): Promise<void> {
        const deletedGame = await this.gameModel.findByIdAndDelete(id);
        if (!deletedGame) {
            this.logger.log('No game found with this id');
            throw new Error('No game found with this id');
        } else {
            this.logger.log(`Game with ID: ${id} was successfully deleted.`);
        }
    }

    
    async updateVisibility(id: string, isVisible: boolean): Promise<void> {
        try {
            await this.gameModel.findByIdAndUpdate(id, { isVisible }, { new: true }).exec();
        } catch (error) {
            throw new Error(`Failed to update game visibility: ${error}`);
        }
    }
}