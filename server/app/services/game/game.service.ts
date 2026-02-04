import { CreateGameDto} from '@app/model/dto/game/create-game.dto';
import { GameMode} from '@app/utils/game.enum';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameValidatorService } from './gameValidator.service';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { MAX_PLAYERS, MIN_PLAYERS, TEN } from '@app/utils/game.constants';

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
        const validGame1: CreateGameDto = {
            name: 'Valid Game 1',
            description: 'Desc. 1',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MAX_PLAYERS,
            grid: this.gameValidatorService.generateValidGrid(TEN, TEN),
            isVisible: true,
        };

        const validGame2: CreateGameDto = {
            name: 'Valid Game 2',
            description: 'Desc. 2',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MIN_PLAYERS,
            grid: this.gameValidatorService.generateValidGrid(TEN, TEN),
            isVisible: false,
        };

        const invalidGame3: CreateGameDto = {
            name: 'Invalid Game 3',
            description: 'Desc. 3',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MIN_PLAYERS,
            grid: this.gameValidatorService.generateInvalidGrid(TEN, TEN),
            isVisible: true,
        };

        const defaultGames: CreateGameDto[] = [validGame1, validGame2, invalidGame3];
        this.logger.log('THIS ADDS DATA TO THE DATABASE, DO NOT USE OTHERWISE');
        await this.gameModel.insertMany(defaultGames);
    }

    async isGameNameUnique(gameName: string, gameId?: string): Promise<boolean> {
        const nameExists = await this.gameModel.findOne({ name: gameName }).exec();
        // if name is unique && if name exists but we're updating a game
        if (!nameExists || (gameId && nameExists._id.toString() === gameId)) return true;

        throw new Error('The name of the game is not unique!');
    }

    async getAllGames(): Promise<Game[]> {
        const allGames = await this.gameModel.find().exec();
        if (allGames.length === 0) {
            this.logger.log('No games found in the database');
            throw new Error('No games found in the database');
        }
        return allGames;
    }

    async getGameById(wantedId: string): Promise<Game> {
        const game = await this.gameModel.findById(wantedId).exec();
        if (!game) {
            this.logger.log('No game found with this id');
            throw new Error('No game found with this id');
        }
        return game;
    }

    async getAllVisibleGames(): Promise<Game[]> {
        const visibleGames = await this.gameModel.find({isVisible: true}).exec();
        if (visibleGames.length === 0) {
            this.logger.log('No visible games found in the database');
            throw new Error('No visible games found in the database');
        }
        return visibleGames;
    }

    async addGame(game: CreateGameDto): Promise<void> {
        try {
            await this.isGameNameUnique(game.name);
            await this.gameValidatorService.isGameValid(game);
            await this.gameModel.create(game);
        } catch (error) {
            this.logger.log(`Failed to create game: ${error.message}`);
            throw new Error(`Failed to create game: ${error.message}`);
        }
    }

    async modifyGame(id: string, game: UpdateGameDto): Promise<void> {
        try {
            const existingGame = await this.gameModel.findById(id).lean();
            if (!existingGame) {
                throw new Error('No game found with this id');
            }

            if (game.name) {
            await this.isGameNameUnique(game.name, id);
            }

            const { _id: _, ...gameWithoutId } = existingGame;
            void _;
            const fullGameData = {...gameWithoutId, ...game}; // new properies from game replace the olds

            this.gameValidatorService.isGameValid(fullGameData);
            await this.gameModel.findByIdAndUpdate(id, fullGameData, {new: true }).exec();
        } catch (error) {
            this.logger.error(`Failed to update game: ${error.message}`);
            throw new Error(`Failed to update game: ${error.message}`);
        }
    }

    async deleteGame(id: string): Promise<void> {
        try {
            const deletedGame = await this.gameModel.findByIdAndDelete(id).exec();
            if (!deletedGame) {
                this.logger.log('No game found with this id');
                throw new Error('No game found with this id');
            }
            this.logger.log(`Game with ID: ${id} was successfully deleted.`);
        } catch (error) {
            this.logger.log(`Error during game deletion: ${error.message}`);
            throw new Error(`Error during game deletion: ${error.message}`);
        }
    }
    
    async updateVisibility(id: string, newVisibility: boolean): Promise<void> {
        try {
            const result = await this.gameModel.findByIdAndUpdate(id, {isVisible: newVisibility }, { new: true }).exec();
            if (!result) {
                throw new Error('No game found with this id');
            }
            this.logger.log(`Visibility updated to ${newVisibility} for game ${id}`);
        } catch (error) {
            this.logger.error(`Failed to update game visibility: ${error.message}`);
            throw new Error(`Failed to update game visibility: ${error.message}`);
        }
    }
}