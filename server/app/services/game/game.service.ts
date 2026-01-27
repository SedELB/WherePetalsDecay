import { Model } from 'mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from './gameValidator.service';
import { GameMode } from '@app/model/schema/game.constants';


@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
        private readonly logger: Logger,
        private readonly gameValidatorService: GameValidatorService
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
                gameMode: GameMode.CLASSIC,
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
        return await this.gameModel.findById({wantedId}).exec();
    }

    async addGame(game: CreateGameDto): Promise<Game> {
        if (!await this.gameValidatorService.isGameNameUnique(game.name)) {
            return Promise.reject('Le jeu existe déjà.');
            // throw new Error('Le nom du jeu existe déjà.'); 
        }

        if (!this.gameValidatorService.isGameSurfaceValid(game)) {
            return Promise.reject("La surface du jeu n'est pas valide.");
            // throw new Error('La surface du jeu n’est pas valide .');
        }

        if (!this.gameValidatorService.areAllSpawnPointsPlaced(game)) {
            return Promise.reject("Les points de départs n'ont pas tous été mis.");
            // throw new Error("Les points de départs n'ont pas tous été mis.");
        }

        try {
            await this.gameModel.create(game);
        } catch (error) {
            return Promise.reject(`Failed to insert game: ${error}`);
            // this.logger.error(`Erreur lors de la création du jeu: ${error.message}`);
            // throw new InternalServerErrorException('Échec de l’insertion du jeu dans la base de données');
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