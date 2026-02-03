import { Test } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import { GameService } from './game.service';
import { Game, gameSchema, GameDocument } from '@app/model/schema/game.schema';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MAX_PLAYERS, MIN_PLAYERS, TEN } from '@app/utils/game.constants';
import { GameMode } from '@app/utils/game.enum';
import { ObjectId } from 'mongodb';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from './gameValidator.service';

describe('GameServiceE2E', () => {
    let gameService: GameService;
    let gameValidatorService: GameValidatorService;
    let gameModel: Model<GameDocument>;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
    let validGame1: CreateGameDto;
    let invalidGame3: CreateGameDto;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create(); // Create an instance of a fake DB.
        
        // Creating a temporary testing module simulating the real GameModule (with its dependencies)
        const testModule = await Test.createTestingModule({
            imports: [
                MongooseModule.forRootAsync({ // Configures the async MongoDB connection.
                    useFactory: () => ({ // Function returns the connection config.
                        uri: mongoServer.getUri(), // Uses the fake DB uri.
                    }),
                }),
                // Links the gameSchema to create a model that follows it.
                MongooseModule.forFeature([{ name: Game.name, schema: gameSchema}]),
            ],
            providers: [GameService, Logger, GameValidatorService], // allows usage of GameService and Logger,
        }).compile();

        // Gets the GameService instance of the created testModule.
        gameService = testModule.get<GameService>(GameService);
        gameValidatorService = testModule.get<GameValidatorService>(GameValidatorService);
        // Gets the real gameModel (collection) 
        gameModel = testModule.get<Model<GameDocument>>(getModelToken(Game.name));
        // Gets the Mongoose connection (invisible when interacting w the real DB).
        connection = await testModule.get(getConnectionToken());
        validGame1 = {
            name: 'Valid Game 1',
            description: 'Desc. 1',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MAX_PLAYERS,
            grid: gameValidatorService.generateValidGrid(TEN, TEN),
            isVisible: true,
        };

        invalidGame3 = {
            name: 'Invalid Game 3',
            description: 'Desc. 3',
            size: {rows: TEN, cols: TEN},
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MIN_PLAYERS,
            grid: gameValidatorService.generateInvalidGrid(TEN, TEN),
            isVisible: true,
        };
    });

    afterEach(async () => {
        await gameModel.deleteMany({}); // Deletes everything in the DB after each test.
    });

    afterAll(async () => { // After all tests, closes the connection and stops the fakeDB.
        await connection.close();
        await mongoServer.stop({doCleanup: true});
    });

    it('service and model should be defined', () => {
        expect(gameService).toBeDefined();
        expect(gameModel).toBeDefined();
    });

    it('start() should populate the database when there is no data', async () => {
        const spyPopulateDB = jest.spyOn(gameService, 'populateDB');
        await gameModel.deleteMany({});
        await gameService.start();
        expect(spyPopulateDB).toHaveBeenCalled();
    });

    it('populateDB() should add 3 new games', async () => {
        const countsBefore = await gameModel.countDocuments();
        await gameService.populateDB();
        const countsAfter = await gameModel.countDocuments();
        expect(countsAfter).toBeGreaterThan(countsBefore);
    });

    it('getAllGames() return all three games in database', async () => {
        await gameService.populateDB();
        expect((await gameService.getAllGames()).length).toBeGreaterThan(2);
    });

    it('getGameById() return correct game with the specified id', async () => {
        const createdGame = await gameModel.create(validGame1);
        expect(await gameService.getGameById(createdGame._id.toString())).toMatchObject(validGame1);
    });

    it('addGame() should add a valid game to the DB', async () => {
        await gameService.addGame(validGame1);
        expect(await gameModel.countDocuments()).toEqual(1);
    });

    it('addGame() with an invalid game should throw an error', async () => {
        await expect(gameService.addGame(invalidGame3)).rejects.toThrow();
    });

    it('modifyGame() should modify a game', async () => {
        const createdGame = await gameModel.create(validGame1);
        const modifiedFakeGame = {...validGame1, name: 'Modified Game'};
        await gameService.modifyGame(createdGame._id.toString(), modifiedFakeGame);
        expect(await gameService.getGameById(createdGame._id.toString())).toMatchObject(modifiedFakeGame);
    });

    it('modifyGame() with an invalid id should fail', async () => {
        const modifiedFakeGame = validGame1;
        const nonExistentId = new ObjectId().toString();
        modifiedFakeGame.name = 'Modified Game';
        await expect(gameService.modifyGame(nonExistentId + 'INVALID', modifiedFakeGame)).rejects.toThrow();
    });

    it('modifyGame() should fail if the game does not exist', async () => {
        const modifiedFakeGame = validGame1;
        modifiedFakeGame.name = 'Modified Game';
        const nonExistentId = new ObjectId().toString();
        await expect(gameService.modifyGame(nonExistentId, modifiedFakeGame)).rejects.toThrow();
    });

    it('deleteGame() should delete the game with the specified id', async () => {
        const createdGame = await gameModel.create(validGame1);
        await gameService.deleteGame(createdGame._id.toString());
        expect(await gameModel.countDocuments()).toEqual(0);
    });

    it('deleteCourse() should fail if the course does not exist', async () => {
        const nonExistentId = new ObjectId().toString();
        await expect(gameService.deleteGame(nonExistentId)).rejects.toThrow();
    });

    it('updateVisibility() should update the game visibility', async () => {
        const createdGame = await gameModel.create(validGame1);
        await gameService.updateVisibility(createdGame._id.toString(), false);
        expect((await gameService.getGameById(createdGame._id.toString())).isVisible).toEqual(false);
    });

    it('updateVisibility() should fail if the game does not exist', async () => {
        await gameModel.create(validGame1);
        const nonExistentId = new ObjectId().toString();
        await expect(gameService.updateVisibility(nonExistentId, false)).rejects.toThrow();
    });
});