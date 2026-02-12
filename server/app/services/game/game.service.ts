import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { BASE_10, BASE_15, CUSTOM_GRID_CLASSIC_MEDIUM, CUSTOM_GRID_CLASSIC_SMALL, CUSTOM_GRID_CTF_SMALL } from '@app/utils/game.constants';
import { THUMBNAIL1_INIT } from '@app/utils/thumbnail.constants/thumbnail1.constant';
import { THUMBNAIL2_INIT } from '@app/utils/thumbnail.constants/thumbnail2.constant';
import { THUMBNAIL3_INIT } from '@app/utils/thumbnail.constants/thumbnail3.constant';


import { GameMode, NbPlayersMedium, NbPlayersSmall } from '@app/utils/game.enum';
import {
    GAME_CREATION_FAILED,
    GAME_DELETION_FAILED,
    GAME_NAME_NOT_UNIQUE,
    GAME_NOT_FOUND,
    GAME_UPDATE_FAILED,
    GAME_VISIBILITY_UPDATE_FAILED,
    NO_GAMES_FOUND,
    NO_VISIBLE_GAMES_FOUND,
} from '@common/error-messages';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameValidatorService } from './gameValidator.service';

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
            description: 'Desc. 1 - CLASSIC',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Classic,
            thumbnail: THUMBNAIL1_INIT,
            maxPlayers: NbPlayersSmall.MaxPLayers,
            grid: CUSTOM_GRID_CLASSIC_SMALL,
            isVisible: true,
        };

        const validGame2: CreateGameDto = {
            name: 'Valid Game 2',
            description: 'Desc. 2 - CTF',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Ctf,
            thumbnail: THUMBNAIL2_INIT,
            maxPlayers: NbPlayersSmall.MaxPLayers,
            grid: CUSTOM_GRID_CTF_SMALL,
            isVisible: false,
        };

        const invalidGame3: CreateGameDto = {
            name: 'Invalid Game 3',
            description: 'Desc. 3 - CLASSIC',
            size: { rows: BASE_15, cols: BASE_15 },
            gameMode: GameMode.Classic,
            thumbnail: THUMBNAIL3_INIT,
            maxPlayers: NbPlayersMedium.MaxPLayers,
            grid: CUSTOM_GRID_CLASSIC_MEDIUM,
            isVisible: true,
        };

        const defaultGames: CreateGameDto[] = [validGame1, validGame2, invalidGame3];
        this.logger.log('Populating the database with default games.');
        await this.gameModel.insertMany(defaultGames);
    }

    // validator that uses mongoose (async)
    async isGameNameUnique(gameName: string, gameId?: string): Promise<boolean> {
        const nameExists = await this.gameModel.findOne({ name: gameName }).exec();
        // if name is unique && if name exists but we're updating a game
        if (!nameExists || (gameId && nameExists._id.toString() === gameId)) return true;

        throw new Error(GAME_NAME_NOT_UNIQUE);
    }

    async getAllGames(): Promise<Game[]> {
        const allGames = await this.gameModel.find().exec();
        if (allGames.length === 0) {
            throw new Error(NO_GAMES_FOUND);
        }
        return allGames;
    }

    async getGameById(wantedId: string): Promise<Game> {
        const game = await this.gameModel.findById(wantedId).exec();
        if (!game) {
            throw new Error(GAME_NOT_FOUND);
        }
        return game;
    }

    async getAllVisibleGames(): Promise<Game[]> {
        const visibleGames = await this.gameModel.find({ isVisible: true }).exec();
        if (visibleGames.length === 0) {
            throw new Error(NO_VISIBLE_GAMES_FOUND);
        }
        return visibleGames;
    }

    async addGame(game: CreateGameDto): Promise<Game> {
        try {
            await this.isGameNameUnique(game.name);
            await this.gameValidatorService.isGameValid(game);
            game.isVisible = false;         // Visibility is false by default
            const createdGame = await this.gameModel.create(game);
            return createdGame;
        } catch (error) {
            throw new Error(`${GAME_CREATION_FAILED}: ${error.message}`);
        }
    }

    async modifyGame(id: string, game: UpdateGameDto): Promise<Game> {
        try {
            const existingGame = await this.gameModel.findById(id).lean();
            if (!existingGame) {
                throw new Error(GAME_NOT_FOUND);
            }

            if (game.name) {
                await this.isGameNameUnique(game.name, id);
            }

            const fullGameData = { ...existingGame, ...game };    // new properies from game replace the olds
            this.gameValidatorService.isGameValid(fullGameData);
            fullGameData.isVisible = false;                     // Default value of a modified game
            const updatedGame = await this.gameModel.findByIdAndUpdate(id, fullGameData, { new: true }).exec();
            return updatedGame;
        } catch (error) {
            throw new Error(`${GAME_UPDATE_FAILED} : ${error.message}`);
        }
    }

    async deleteGame(id: string): Promise<void> {
        try {
            const deletedGame = await this.gameModel.findByIdAndDelete(id).exec();
            if (!deletedGame) {
                throw new Error(GAME_NOT_FOUND);
            }
            this.logger.log(`Game with ID: ${id} was successfully deleted.`);
        } catch (error) {
            throw new Error(`${GAME_DELETION_FAILED} : ${error.message}`);
        }
    }

    async updateVisibility(id: string, newVisibility: boolean): Promise<void> {
        try {
            const updatedGame = await this.gameModel.findByIdAndUpdate(id, { isVisible: newVisibility }, { new: true, timestamps: false }).exec();
            if (!updatedGame) {
                throw new Error(GAME_NOT_FOUND);
            }
        } catch (error) {
            throw new Error(`${GAME_VISIBILITY_UPDATE_FAILED} : ${error.message}`);
        }
    }
}