import { Test } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import { GameService } from './game.service';
import { Game, gameSchema, GameDocument } from '@app/model/schema/game.schema';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MAX_PLAYERS } from '@app/utils/game.constants';
import { GameMode, TileTexture } from '@app/utils/game.enum';
import { ObjectId } from 'mongodb';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';

describe('GameServiceE2E', () => {
    let gameService: GameService;
    let gameModel: Model<GameDocument>;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;

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
            providers: [GameService, Logger], // allows usage of GameService and Logger,
        }).compile();

        // Gets the GameService instance of the created testModule.
        gameService = testModule.get<GameService>(GameService);
        // Gets the real gameModel (collection) 
        gameModel = testModule.get<Model<GameDocument>>(getModelToken(Game.name));
        // Gets the Mongoose connection (invisible when interacting w the real DB).
        connection = await testModule.get(getConnectionToken());
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
        const eltCountsBefore = await gameModel.countDocuments();
        await gameService.populateDB();
        const eltCountsAfter = await gameModel.countDocuments();
        expect(eltCountsAfter).toBeGreaterThan(eltCountsBefore);
    });

    it('getAllGames() return all three games in database', async () => {
        await gameService.populateDB();
        expect((await gameService.getAllGames()).length).toBeGreaterThan(2);
    });

    it('getGameById() return correct game with the specified id', async () => {
        const fakeGame = getFakeGame();
        await gameModel.create(fakeGame);
        expect(await gameService.getGameById(fakeGame._id.toString())).toEqual(expect.objectContaining(fakeGame));
    });

    it('addGame() should add the game to the DB', async () => {
        const fakeGame = getFakeGame();
        await gameService.addGame(fakeGame as CreateGameDto);
        expect(await gameModel.countDocuments()).toEqual(1);
        expect(await gameService.getGameById(fakeGame._id.toString())).toEqual(expect.objectContaining(fakeGame));
    });

    it('modifyGame() should modify a game', async () => {
        const fakeGame = getFakeGame();
        await gameModel.create(fakeGame);
        const modifiedFakeGame = getFakeGame();
        modifiedFakeGame.name = 'Modified Game';
        await gameService.modifyGame(fakeGame._id.toString(), modifiedFakeGame as UpdateGameDto);
        expect(await gameService.getGameById(fakeGame._id.toString())).toMatchObject(modifiedFakeGame);
    });

    it('deleteGame() should delete the game with the specified id', async () => {
        const fakeGame = getFakeGame();
        await gameModel.create(fakeGame);
        await gameService.deleteGame(fakeGame._id.toString());
        expect(await gameModel.countDocuments()).toEqual(0);
    });

    it('deleteCourse() should fail if the course does not exist', async () => {
        const fakeGame = getFakeGame();
        await expect(gameService.deleteGame(fakeGame._id.toString())).rejects.toThrow();
    });

    it('updateVisibility() should update the game visibility', async () => {
        const fakeGame = getFakeGame();
        await gameModel.create(fakeGame);
        await gameService.updateVisibility(fakeGame._id.toString(), false);
        expect((await gameService.getGameById(fakeGame._id.toString())).isVisible).toEqual(false);
    });


});

const getFakeGame = (): Game & {_id: ObjectId} => ({
    _id: new ObjectId('507f1f77bcf86cd799439011'),
    name: 'RandomGame',
    description: 'RandomDesc',
    size: {
        rows: 10,
        cols: 10,
    },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: MAX_PLAYERS,
    grid: [[
        {type : TileTexture.Floor, item: null},
    ]],
    isVisible: true,
});