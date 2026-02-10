import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { BASE_10, BASE_15, CUSTOM_GRID_CLASSIC_MEDIUM, CUSTOM_GRID_CLASSIC_SMALL, CUSTOM_GRID_CTF_SMALL } from '@app/utils/game.constants';
import { GameMode, NbPlayersMedium, NbPlayersSmall } from '@app/utils/game.enum';
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
            thumbnail: 'N/A',
            maxPlayers: NbPlayersSmall.MaxPLayers,
            grid: CUSTOM_GRID_CLASSIC_SMALL,
            isVisible: true,
        };

        const validGame2: CreateGameDto = {
            name: 'Valid Game 2',
            description: 'Desc. 2 - CTF',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Ctf,
            thumbnail: 'N/A',
            maxPlayers: NbPlayersSmall.MaxPLayers,
            grid: CUSTOM_GRID_CTF_SMALL,
            isVisible: false,
        };

        const invalidGame3: CreateGameDto = {
            name: 'Invalid Game 3',
            description: 'Desc. 3 - CLASSIC',
            size: { rows: BASE_15, cols: BASE_15 },
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
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

        throw new Error("Le nom du jeu n'est pas unique !");
    }

    async getAllGames(): Promise<Game[]> {
        const allGames = await this.gameModel.find().exec();
        if (allGames.length === 0) {
            throw new Error('Aucun jeu trouvé dans la base de données');
        }
        return allGames;
    }

    async getGameById(wantedId: string): Promise<Game> {
        const game = await this.gameModel.findById(wantedId).exec();
        if (!game) {
            throw new Error('Aucun jeu trouvé avec cet identifiant');
        }
        return game;
    }

    async getAllVisibleGames(): Promise<Game[]> {
        const visibleGames = await this.gameModel.find({ isVisible: true }).exec();
        if (visibleGames.length === 0) {
            throw new Error('Aucun jeu visible trouvé dans la base de données');
        }
        return visibleGames;
    }

    async addGame(game: CreateGameDto): Promise<void> {
        try {
            await this.isGameNameUnique(game.name);
            await this.gameValidatorService.isGameValid(game);
            game.isVisible = false;         // Default value should be false when creating game
            await this.gameModel.create(game);
        } catch (error) {
            throw new Error(`Echec lors de la création de jeu: ${error.message}`);
        }
    }

    async modifyGame(id: string, game: UpdateGameDto): Promise<void> {
        try {
            const existingGame = await this.gameModel.findById(id).lean();
            if (!existingGame) {
                throw new Error('Aucun jeu trouvé avec cet identifiant');
            }

            if (game.name) {
                await this.isGameNameUnique(game.name, id);
            }

            const fullGameData = { ...existingGame, ...game };    // new properies from game replace the olds
            this.gameValidatorService.isGameValid(fullGameData);
            fullGameData.isVisible = false;                     // Default value of a modified game
            await this.gameModel.findByIdAndUpdate(id, fullGameData, { new: true }).exec();
        } catch (error) {
            throw new Error(`Echec lors de la mise à jour du jeu : ${error.message}`);
        }
    }

    async deleteGame(id: string): Promise<void> {
        try {
            const deletedGame = await this.gameModel.findByIdAndDelete(id).exec();
            if (!deletedGame) {
                throw new Error('Aucun jeu trouvé avec cet identifiant');
            }
            this.logger.log(`Game with ID: ${id} was successfully deleted.`);
        } catch (error) {
            throw new Error(`Erreur lors de la suppression du jeu : ${error.message}`);
        }
    }

    async updateVisibility(id: string, newVisibility: boolean): Promise<void> {
        try {
            const updatedGame = await this.gameModel.findByIdAndUpdate(id, { isVisible: newVisibility }, { new: true, timestamps: false }).exec();
            if (!updatedGame) {
                throw new Error('Aucun jeu trouvé avec cet identifiant');
            }
        } catch (error) {
            throw new Error(`Echec lors de la mise à jour de la visibilité du jeu : ${error.message}`);
        }
    }
}