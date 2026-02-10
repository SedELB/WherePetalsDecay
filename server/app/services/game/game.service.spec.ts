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
const THREE = 3;

describe('GameServiceE2E', () => {
    let gameService: GameService;
    let gameValidatorService: GameValidatorService;
    let gameModel: Model<GameDocument>;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
    let validGame1: CreateGameDto;
    let invalidGame3: CreateGameDto;
    let logger: Logger;

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
        logger = testModule.get<Logger>(Logger);
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
        const spyCountDocuments = jest.spyOn(gameModel, 'countDocuments');
        await gameModel.deleteMany({});
        await gameService.start();
        expect(spyPopulateDB).toHaveBeenCalled();
        expect(spyCountDocuments).toHaveBeenCalled();
    });

    it('populateDB() should add 3 new games', async () => {
        const countsBefore = await gameModel.countDocuments();
        const spyInsertMany = jest.spyOn(gameModel, 'insertMany');
        const spyLog = jest.spyOn(logger, 'log');
        await gameService.populateDB();
        const countsAfter = await gameModel.countDocuments();
        expect(countsAfter).toBeGreaterThan(countsBefore);
        expect(spyInsertMany).toHaveBeenCalled();
        expect(spyLog).toHaveBeenCalledWith('THIS ADDS DATA TO THE DATABASE, DO NOT USE OTHERWISE');
    });

    it('isGameNameUnique() should return true if the game name is unique', async () => {
        const spyFindOne = jest.spyOn(gameModel, 'findOne');
        const result = await gameService.isGameNameUnique('Completely Unique Name');
        expect(result).toEqual(true);
        expect(spyFindOne).toHaveBeenCalledWith({name: 'Completely Unique Name'});
    });

    it('isGameNameUnique() should throw error if the game name already exists', async () => {
        const createdGame = await gameModel.create(validGame1);
        const spyFindOne = jest.spyOn(gameModel, 'findOne');
        await expect(gameService.isGameNameUnique(createdGame.name)).rejects.toThrow('The name of the game is not unique!');
        expect(spyFindOne).toHaveBeenCalledWith({name: createdGame.name});
    });

    it('getAllGames() return all three games in database', async () => {
        const spyFind = jest.spyOn(gameModel, 'find');
        await gameService.populateDB();
        const result = await gameService.getAllGames();
        expect(result.length).toBeGreaterThan(2);
        expect(spyFind).toHaveBeenCalled();
    });

    it('getAllGames() should fail if there are no games in the database', async () => {
        const spyLog = jest.spyOn(logger, 'log');
        await expect((gameService.getAllGames())).rejects.toThrow('No games found in the database');
        expect(spyLog).toHaveBeenCalledWith('No games found in the database');
    });

    it('getGameById() return correct game with the specified id', async () => {
        const createdGame = await gameModel.create(validGame1);
        const spyFindById = jest.spyOn(gameModel, 'findById');
        const result = await gameService.getGameById(createdGame._id.toString());
        expect(result).toMatchObject(validGame1);
        expect(spyFindById).toHaveBeenCalledWith(createdGame._id.toString());
    });

    it('getGameById() should fail if there are no game with the specified id', async () => {
        const nonExistentId = new ObjectId().toString();
        const spyLog = jest.spyOn(logger, 'log');
        await expect(gameService.getGameById(nonExistentId)).rejects.toThrow('No game found with this id');
        expect(spyLog).toHaveBeenCalledWith('No game found with this id');
    });

    it('addGame() should add a valid game to the DB', async () => {
        const spyIsGameNameUnique = jest.spyOn(gameService, 'isGameNameUnique');
        const spyIsGameValid = jest.spyOn(gameValidatorService, 'isGameValid');
        await gameService.addGame(validGame1);
        expect(await gameModel.countDocuments()).toEqual(1);
        expect(spyIsGameNameUnique).toHaveBeenCalledWith(validGame1.name);
        expect(spyIsGameValid).toHaveBeenCalledWith(expect.objectContaining({
            name: validGame1.name,
            description: validGame1.description,
        }));
    });

    it('addGame() with an invalid game should throw an error', async () => {
        const spyIsGameNameUnique = jest.spyOn(gameService, 'isGameNameUnique');
        const spyIsGameValid = jest.spyOn(gameValidatorService, 'isGameValid');
        await expect(gameService.addGame(invalidGame3)).rejects.toThrow();
        expect(spyIsGameNameUnique).toHaveBeenCalledWith(invalidGame3.name);
        expect(spyIsGameValid).toHaveBeenCalled();
    });

    it('modifyGame() should modify a game', async () => {
        const createdGame = await gameModel.create(validGame1);
        const modifiedFakeGame = {...validGame1, name: 'Modified Game'};
        const spyIsGameNameUnique = jest.spyOn(gameService, 'isGameNameUnique');
        const spyIsGameValid = jest.spyOn(gameValidatorService, 'isGameValid');
        await gameService.modifyGame(createdGame._id.toString(), modifiedFakeGame);
        expect(await gameService.getGameById(createdGame._id.toString())).toMatchObject(modifiedFakeGame);
        expect(spyIsGameNameUnique).toHaveBeenCalledWith('Modified Game', createdGame._id.toString());
        expect(spyIsGameValid).toHaveBeenCalled();
    });

    it('modifyGame() with an invalid id should fail', async () => {
        const modifiedFakeGame = validGame1;
        const nonExistentId = new ObjectId().toString();
        modifiedFakeGame.name = 'Modified Game';
        const spyError = jest.spyOn(logger, 'error');
        await expect(gameService.modifyGame(nonExistentId + 'INVALID', modifiedFakeGame)).rejects.toThrow();
        expect(spyError).toHaveBeenCalled();
    });

    it('modifyGame() should fail if the game does not exist', async () => {
        const modifiedFakeGame = validGame1;
        modifiedFakeGame.name = 'Modified Game';
        const nonExistentId = new ObjectId().toString();
        const spyFindById = jest.spyOn(gameModel, 'findById');
        const spyError = jest.spyOn(logger, 'error');
        await expect(gameService.modifyGame(nonExistentId, modifiedFakeGame)).rejects.toThrow('No game found with this id');
        expect(spyFindById).toHaveBeenCalledWith(nonExistentId);
        expect(spyError).toHaveBeenCalled();
    });

    it('deleteGame() should delete the game with the specified id', async () => {
        const createdGame = await gameModel.create(validGame1);
        const spyFindByIdAndDelete = jest.spyOn(gameModel, 'findByIdAndDelete');
        await gameService.deleteGame(createdGame._id.toString());
        expect(await gameModel.countDocuments()).toEqual(0);
        expect(spyFindByIdAndDelete).toHaveBeenCalledWith(createdGame._id.toString());
    });

    it('deleteCourse() should fail if the course does not exist', async () => {
        const nonExistentId = new ObjectId().toString();
        const spyLog = jest.spyOn(logger, 'log');
        await expect(gameService.deleteGame(nonExistentId)).rejects.toThrow();
        expect(spyLog).toHaveBeenCalled();
    });

    it('updateVisibility() should update the game visibility', async () => {
        const createdGame = await gameModel.create(validGame1);
        const spyFindByIdAndUpdate = jest.spyOn(gameModel, 'findByIdAndUpdate');
        await gameService.updateVisibility(createdGame._id.toString(), false);
        expect((await gameService.getGameById(createdGame._id.toString())).isVisible).toEqual(false);
        expect(spyFindByIdAndUpdate).toHaveBeenCalledWith(
            createdGame._id.toString(),
            {isVisible: false},
            {new: true, timestamps: false},
        );
    });

    it('updateVisibility() should fail if the game does not exist', async () => {
        await gameModel.create(validGame1);
        const nonExistentId = new ObjectId().toString();
        const spyError = jest.spyOn(logger, 'error');
        await expect(gameService.updateVisibility(nonExistentId, false)).rejects.toThrow();
        expect(spyError).toHaveBeenCalled();
    });

    it('getAllVisibleGames() should return all visible games', async () => {
        const visibleGame1 = {...validGame1, name: 'Visible game 1', isVisible: true};
        const visibleGame2 = {...validGame1, name: 'Visible game 2', isVisible: true};
        const visibleGame3 = {...validGame1, name: 'Visible game 3', isVisible: true};
        await gameModel.create([visibleGame1, visibleGame2, visibleGame3]);
        await gameModel.updateMany({}, {isVisible: true});
        const spyFind = jest.spyOn(gameModel, 'find');
        const result = await gameService.getAllVisibleGames();
        expect(result.length).toEqual(THREE);
        expect(spyFind).toHaveBeenCalledWith({isVisible: true});
    });

    it('getAllVisibleGames() should fail if there are no visible games in the database', async () => {
        const nonVisibleGame = {...validGame1, isVisible: false};
        await gameService.addGame(nonVisibleGame);
        const spyLog = jest.spyOn(logger, 'log');
        await expect(gameService.getAllVisibleGames()).rejects.toThrow('No visible games found in the database');
        expect(spyLog).toHaveBeenCalledWith('No visible games found in the database');
    });

});