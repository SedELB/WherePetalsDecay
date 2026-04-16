import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { BASE_10, BASE_15, CUSTOM_GRID_CLASSIC_MEDIUM, CUSTOM_GRID_CLASSIC_SMALL, CUSTOM_GRID_CTF_SMALL } from '@app/utils/game.constants';
import { THUMBNAIL1_INIT } from '@app/utils/thumbnail.constants/thumbnail1.constant';
import { THUMBNAIL2_INIT } from '@app/utils/thumbnail.constants/thumbnail2.constant';
import { THUMBNAIL3_INIT } from '@app/utils/thumbnail.constants/thumbnail3.constant';

import { GameMode, MaxPlayers } from '@common/enums';
import {
    GAME_DELETION_FAILED,
    GAME_NAME_NOT_UNIQUE,
    GAME_NOT_FOUND,
    GAME_VISIBILITY_UPDATE_FAILED,
    NO_GAMES_FOUND,
    NO_VISIBLE_GAMES_FOUND,
} from '@common/error-messages';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameValidatorService } from './game-validator.service';

@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
        private readonly logger: Logger,
        private readonly gameValidatorService: GameValidatorService,
    ) {
        this.start();
    }

    private async start(): Promise<void> {
        if ((await this.gameModel.countDocuments()) === 0) {
            await this.populateDB();
        }
    }

    private async populateDB(): Promise<void> {
        const validGame1: CreateGameDto = {
            name: 'Valid Game 1',
            description: 'Desc. 1 - CLASSIC',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Classic,
            thumbnail: THUMBNAIL1_INIT,
            maxPlayers: MaxPlayers.Small,
            grid: CUSTOM_GRID_CLASSIC_SMALL,
            isVisible: true,
        };

        const validGame2: CreateGameDto = {
            name: 'Valid Game 2',
            description: 'Desc. 2 - CTF',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Ctf,
            thumbnail: THUMBNAIL2_INIT,
            maxPlayers: MaxPlayers.Small,
            grid: CUSTOM_GRID_CTF_SMALL,
            isVisible: false,
        };

        const invalidGame3: CreateGameDto = {
            name: 'Valid Game 3',
            description: 'Desc. 3 - CLASSIC',
            size: { rows: BASE_15, cols: BASE_15 },
            gameMode: GameMode.Classic,
            thumbnail: THUMBNAIL3_INIT,
            maxPlayers: MaxPlayers.Medium,
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`${errorMessage}`);
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`${errorMessage}`);
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`${GAME_DELETION_FAILED} : ${errorMessage}`);
        }
    }

    async updateVisibility(id: string, newVisibility: boolean): Promise<Game> {
        try {
            const updatedGame = await this.gameModel.findByIdAndUpdate(id, { isVisible: newVisibility }, { new: true, timestamps: false }).exec();
            if (!updatedGame) {
                throw new Error(GAME_NOT_FOUND);
            }
            return updatedGame;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`${GAME_VISIBILITY_UPDATE_FAILED} : ${errorMessage}`);
        }
    }
}
