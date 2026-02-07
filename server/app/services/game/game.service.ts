import { CreateGameDto, TileDto } from '@app/model/dto/game/create-game.dto';
import { GameMode, TileItem, TileTexture } from '@app/utils/game.enum';
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

    // GENERATED
    generateValidGrid(rows: number, cols: number): TileDto[][] {
        const grid: TileDto[][] = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, (): TileDto => ({ type: TileTexture.Floor, item: null })),
        );

        // Places random walls at 30% rate
        // for (let i = 0; i < rows; i++) {
        //     for (let j = 0; j < cols; j++) {
        //         if (Math.random() < 0.3) grid[i][j].type = TileTexture.Wall;
        //     }
        // }

        let spawnCount = 0;
        while (spawnCount < MAX_PLAYERS) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);
            if (grid[r][c].type !== TileTexture.Wall && !grid[r][c].item) {
                grid[r][c].item = TileItem.Spawn;
                spawnCount++;
            }
        }

        return grid;
    }


    generateInvalidGrid(rows: number, cols: number): TileDto[][] {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, (): TileDto => ({ type: TileTexture.Wall, item: null })),  // Tout en murs = invalide
        );
    }

    // GENERATED
    printGrid(game: Game): void {
    const symbols = {
        [TileTexture.Floor]: '.',
        [TileTexture.Wall]: '#',
        [TileTexture.DoorOpened]: 'O',
        [TileTexture.DoorClosed]: 'X',
        // Ajoutez d'autres types si nécessaire
    };

    const itemSymbols = {
        [TileItem.Spawn]: 'S',  // Symbole pour spawn
        // Ajoutez d'autres items si nécessaire
    };

    this.logger.log(`Grille pour le jeu "${game.name}":`);
    game.grid.forEach(row => {
        const rowString = row.map(tile => {
            const symbol = symbols[tile.type] || '?';  // Symbole pour le type
            const itemSymbol = tile.item ? itemSymbols[tile.item] || `(${tile.item})` : '';  // Symbole pour l'item, ou (item) si inconnu
            return itemSymbol || symbol;  // Priorité à l'item si présent
        }).join(' ');
        this.logger.log(rowString);
    });
    this.logger.log('');
}


    async populateDB(): Promise<void> {
        const validGame1: CreateGameDto = {
            name: 'Valid Game 1',
            description: 'Desc. 1',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MAX_PLAYERS,
            grid: this.generateValidGrid(TEN, TEN),
            isVisible: true,
        };

        const validGame2: CreateGameDto = {
            name: 'Valid Game 2',
            description: 'Desc. 2',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MIN_PLAYERS,
            grid: this.generateValidGrid(TEN, TEN),
            isVisible: false,
        };

        const invalidGame3: CreateGameDto = {
            name: 'Invalid Game 3',
            description: 'Desc. 3',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MIN_PLAYERS,
            grid: this.generateInvalidGrid(TEN, TEN),
            isVisible: true,
        };

        this.printGrid(validGame1 as Game);
        this.printGrid(validGame2 as Game);
        this.printGrid(invalidGame3 as Game);

        const defaultGames: CreateGameDto[] = [validGame1, validGame2, invalidGame3];
        this.logger.log('THIS ADDS DATA TO THE DATABASE, DO NOT USE OTHERWISE');
        await this.gameModel.insertMany(defaultGames);
    }

    async getAllGames(): Promise<Game[]> {
        const allGames = await this.gameModel.find().exec();
        if (!allGames) {
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
        if (!visibleGames) {
            this.logger.log('No visible games found in the database');
            throw new Error('No visible games found in the database');
        }
        return visibleGames;
    }

    async addGame(game: CreateGameDto): Promise<void> {
        try {
            await this.gameValidatorService.isGameValid(game);
            await this.gameModel.create(game);
        } catch (error) {
            this.logger.log(`Failed to create game: ${error.message}`);
            throw new Error(`Failed to create game: ${error.message}`);
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