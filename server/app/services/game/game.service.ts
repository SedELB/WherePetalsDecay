import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameMode } from '@app/model/schema/game.constants';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameValidatorService } from './gameValidator.service';
const TEN = 10;

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
            this.gameValidatorService.isGameValid(game);
            await this.gameModel.create(game);
        } catch (error) {
            this.logger.log(`Failed to create game: ${error.message}`);
            return Promise.reject(`Failed to create game: ${error.message}`);
        }
    }

    async modifyGame(id: string, game: CreateGameDto): Promise<void> {
        try {
            const updatedGame = await this.gameModel.findByIdAndUpdate(id, game, { new: true }).exec();
            if (!updatedGame) {
                return Promise.reject('No game found with this id');
            }
        } catch (error) {
            return Promise.reject(`Failed to update game: ${error}`);
        }
        
    }

    async deleteGame(id: string): Promise<void> {
        const deletedGame = await this.gameModel.findByIdAndDelete(id);
        if (!deletedGame) {
            this.logger.log('No game found with this id');
            return Promise.reject('No game found with this id');
        } else {
            this.logger.log(`Game with ID: ${id} was successfully deleted.`);
        }
    }

    
    async updateVisibility(id: string, isVisible: boolean): Promise<Game> {
        try {
            await this.gameModel.findByIdAndUpdate(id, { isVisible }, { new: true }).exec();
        } catch (error) {
            return Promise.reject(`Failed to update game visibility: ${error}`);
        }
    }
}