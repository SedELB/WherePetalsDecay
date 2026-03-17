import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { Game, GameDocument, gameSchema } from '@app/model/schema/game.schema';
import { BASE_10, CUSTOM_GRID_CLASSIC_SMALL, CUSTOM_GRID_CLASSIC_SMALL_INVALID } from '@app/utils/game.constants';
import { GameMode, MaxPlayers } from '@common/enums';
import { GAME_NOT_FOUND, NO_GAMES_FOUND, NO_VISIBLE_GAMES_FOUND } from '@common/error-messages';
import { Logger } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Model } from 'mongoose';
import { GameService } from './game.service';
import { GameValidatorService } from './gameValidator.service';
const BASE_3 = 3;

describe('GameServiceE2E', () => {
    let gameService: GameService;
    let gameValidatorService: GameValidatorService;
    let gameModel: Model<GameDocument>;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
    let validGame: CreateGameDto;
    let invalidGame: CreateGameDto;
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
                MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
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

        validGame = {
            name: 'Valid Game 1',
            description: 'Desc. 1',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MaxPlayers.Small,
            grid: CUSTOM_GRID_CLASSIC_SMALL,
            isVisible: true,
        };

        invalidGame = {
            name: 'Invalid Game 3',
            description: 'Desc. 3',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: MaxPlayers.Small,
            grid: CUSTOM_GRID_CLASSIC_SMALL_INVALID,
            isVisible: true,
        };
    });

    afterEach(async () => {
        await gameModel.deleteMany({}); // Deletes everything in the DB after each test.
    });

    afterAll(async () => { // After all tests, closes the connection and stops the fakeDB.
        await connection.close();
        await mongoServer.stop({ doCleanup: true });
    });

    it('service and model should be defined', () => {
        // Ensures GameService and GameModel are properly injected and available
        expect(gameService).toBeDefined();
        expect(gameModel).toBeDefined();
    });

    it('start() should populate the database when there is no data', async () => {
        // Verifies that DB initialization triggers population with default games
        const spyPopulateDB = jest.spyOn(gameService, 'populateDB');
        const spyCountDocuments = jest.spyOn(gameModel, 'countDocuments');
        await gameModel.deleteMany({});
        await gameService.start();
        expect(spyPopulateDB).toHaveBeenCalled();
        expect(spyCountDocuments).toHaveBeenCalled();
    });

    it('populateDB() should add 3 new games', async () => {
        // Ensures default games are correctly inserted into database
        const countsBefore = await gameModel.countDocuments();
        const spyInsertMany = jest.spyOn(gameModel, 'insertMany');
        const spyLog = jest.spyOn(logger, 'log');
        await gameService.populateDB();
        const countsAfter = await gameModel.countDocuments();
        expect(countsAfter).toBeGreaterThan(countsBefore);
        expect(spyInsertMany).toHaveBeenCalled();
        expect(spyLog).toHaveBeenCalledWith('Populating the database with default games.');
    });

    it('isGameNameUnique() should return true if the game name is unique', async () => {
        // Confirms unique game names pass validation
        const spyFindOne = jest.spyOn(gameModel, 'findOne');
        const result = await gameService.isGameNameUnique('Completely Unique Name');
        expect(result).toEqual(true);
        expect(spyFindOne).toHaveBeenCalledWith({ name: 'Completely Unique Name' });
    });

    it('isGameNameUnique() should throw error if the game name already exists', async () => {
        // Rejects duplicate game names to maintain database integrity
        const createdGame = await gameModel.create(validGame);
        const spyFindOne = jest.spyOn(gameModel, 'findOne');
        await expect(gameService.isGameNameUnique(createdGame.name)).rejects.toThrow("Le nom du jeu n'est pas unique !");
        expect(spyFindOne).toHaveBeenCalledWith({ name: createdGame.name });
    });

    it('getAllGames() return all three games in database', async () => {
        // Retrieves all games from database after population
        const spyFind = jest.spyOn(gameModel, 'find');
        await gameService.populateDB();
        const result = await gameService.getAllGames();
        expect(result.length).toBeGreaterThan(2);
        expect(spyFind).toHaveBeenCalled();
    });

    it('getAllGames() should fail if there are no games in the database', async () => {
        // Throws error when attempting to retrieve from empty database
        await expect((gameService.getAllGames())).rejects.toThrow(NO_GAMES_FOUND);
    });

    it('getGameById() return correct game with the specified id', async () => {
        // Fetches specific game by ID from database
        const createdGame = await gameModel.create(validGame);
        const spyFindById = jest.spyOn(gameModel, 'findById');
        const result = await gameService.getGameById(createdGame._id.toString());
        expect(result).toMatchObject(validGame);
        expect(spyFindById).toHaveBeenCalledWith(createdGame._id.toString());
    });

    it('getGameById() should fail if there are no game with the specified id', async () => {
        // Throws error when game ID does not exist
        const nonExistentId = new ObjectId().toString();
        await expect(gameService.getGameById(nonExistentId)).rejects.toThrow(GAME_NOT_FOUND);
    });

    it('addGame() should add a valid game to the DB', async () => {
        // Validates and inserts new game into database
        const spyIsGameNameUnique = jest.spyOn(gameService, 'isGameNameUnique');
        const spyIsGameValid = jest.spyOn(gameValidatorService, 'isGameValid');
        await gameService.addGame(validGame);
        expect(await gameModel.countDocuments()).toEqual(1);
        expect(spyIsGameNameUnique).toHaveBeenCalledWith(validGame.name);
        expect(spyIsGameValid).toHaveBeenCalledWith(expect.objectContaining({
            name: validGame.name,
            description: validGame.description,
        }));
    });

    it('addGame() with an invalid game should throw an error', async () => {
        // Rejects invalid games failing validator checks
        const spyIsGameNameUnique = jest.spyOn(gameService, 'isGameNameUnique');
        const spyIsGameValid = jest.spyOn(gameValidatorService, 'isGameValid');
        await expect(gameService.addGame(invalidGame)).rejects.toThrow();
        expect(spyIsGameNameUnique).toHaveBeenCalledWith(invalidGame.name);
        expect(spyIsGameValid).toHaveBeenCalled();
    });

    it('modifyGame() should modify a game', async () => {
        // Updates existing game with new data and validates changes
        const createdGame = await gameModel.create(validGame);
        const modifiedFakeGame = { ...validGame, name: 'Modified Game' };
        const spyIsGameNameUnique = jest.spyOn(gameService, 'isGameNameUnique');
        const spyIsGameValid = jest.spyOn(gameValidatorService, 'isGameValid');
        await gameService.modifyGame(createdGame._id.toString(), modifiedFakeGame);
        expect(await gameService.getGameById(createdGame._id.toString())).toMatchObject(modifiedFakeGame);
        expect(spyIsGameNameUnique).toHaveBeenCalledWith('Modified Game', createdGame._id.toString());
        expect(spyIsGameValid).toHaveBeenCalled();
    });

    it('modifyGame() with an invalid id should fail', async () => {
        // Rejects modification requests with malformed ObjectId
        const modifiedFakeGame = validGame;
        const nonExistentId = new ObjectId().toString();
        modifiedFakeGame.name = 'Modified Game';
        await expect(gameService.modifyGame(nonExistentId + 'INVALID', modifiedFakeGame)).rejects.toThrow();
    });

    it('modifyGame() should fail if the game does not exist', async () => {
        // Throws error when attempting to modify non-existent game
        const modifiedFakeGame = validGame;
        modifiedFakeGame.name = 'Modified Game';
        const nonExistentId = new ObjectId().toString();
        const spyFindById = jest.spyOn(gameModel, 'findById');
        await expect(gameService.modifyGame(nonExistentId, modifiedFakeGame)).rejects.toThrow(GAME_NOT_FOUND);
        expect(spyFindById).toHaveBeenCalledWith(nonExistentId);
    });

    it('deleteGame() should delete the game with the specified id', async () => {
        // Removes game from database by ID
        const createdGame = await gameModel.create(validGame);
        const spyFindByIdAndDelete = jest.spyOn(gameModel, 'findByIdAndDelete');
        await gameService.deleteGame(createdGame._id.toString());
        expect(await gameModel.countDocuments()).toEqual(0);
        expect(spyFindByIdAndDelete).toHaveBeenCalledWith(createdGame._id.toString());
    });

    it('deleteCourse() should fail if the course does not exist', async () => {
        // Throws error when attempting to delete non-existent game
        const nonExistentId = new ObjectId().toString();
        const spyLog = jest.spyOn(logger, 'log');
        await expect(gameService.deleteGame(nonExistentId)).rejects.toThrow();
        expect(spyLog).toHaveBeenCalled();
    });

    it('updateVisibility() should update the game visibility', async () => {
        // Changes game's visibility status in database
        const createdGame = await gameModel.create(validGame);
        const spyFindByIdAndUpdate = jest.spyOn(gameModel, 'findByIdAndUpdate');
        await gameService.updateVisibility(createdGame._id.toString(), false);
        expect((await gameService.getGameById(createdGame._id.toString())).isVisible).toEqual(false);
        expect(spyFindByIdAndUpdate).toHaveBeenCalledWith(
            createdGame._id.toString(),
            { isVisible: false },
            { new: true, timestamps: false },
        );
    });

    it('updateVisibility() should fail if the game does not exist', async () => {
        // Throws error when game ID doesn't exist
        await gameModel.create(validGame);
        const nonExistentId = new ObjectId().toString();
        await expect(gameService.updateVisibility(nonExistentId, false)).rejects.toThrow();
    });

    it('getAllVisibleGames() should return all visible games', async () => {
        // Retrieves only publicly visible games from database
        const visibleGame1 = { ...validGame, name: 'Visible game 1', isVisible: true };
        const visibleGame2 = { ...validGame, name: 'Visible game 2', isVisible: true };
        const visibleGame3 = { ...validGame, name: 'Visible game 3', isVisible: true };
        await gameModel.create([visibleGame1, visibleGame2, visibleGame3]);
        await gameModel.updateMany({}, { isVisible: true });
        const spyFind = jest.spyOn(gameModel, 'find');
        const result = await gameService.getAllVisibleGames();
        expect(result.length).toEqual(BASE_3);
        expect(spyFind).toHaveBeenCalledWith({ isVisible: true });
    });

    it('getAllVisibleGames() should fail if there are no visible games in the database', async () => {
        // Throws error when no public games are available
        const nonVisibleGame = { ...validGame, isVisible: false };
        await gameService.addGame(nonVisibleGame);
        await expect(gameService.getAllVisibleGames()).rejects.toThrow(NO_VISIBLE_GAMES_FOUND);
    });

});