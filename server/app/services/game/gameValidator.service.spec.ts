import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TEN, MIN_PLAYERS, DESC_MAX_LENGTH } from '@app/utils/game.constants';
import { GameMode, TileTexture, TileItem } from '@app/utils/game.enum';

describe('GameValidator', () => {
    let gameValidatorService: GameValidatorService;
    let invalidGame3: CreateGameDto;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GameValidatorService, Logger],
        }).compile();

        gameValidatorService = module.get<GameValidatorService>(GameValidatorService);

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

    it('should be defined', () => {
        expect(gameValidatorService).toBeDefined();
    });

    it('countByProperty() should return the correct property count for types', () => {
        const result = gameValidatorService.countByProperty(getFakeGame(), 'type');
        expect(result).toMatchObject({ ice: 3, floor: 84, wall: 9, doorClosed: 3, doorOpened: 1 });
    });

    it('countByProperty() should return the correct property count for items', () => {
        const result = gameValidatorService.countByProperty(getFakeGame(), 'item');
        expect(result).toMatchObject({ spawn: 2, combatSanctuary: 4 });
    });

    // TEST isGameNameUnique A FAIRE

    it('isTextLengthValid() should return true if the game name and desc are valid', () => {
        expect(gameValidatorService.isTextLengthValid(getFakeGame())).toEqual(true);
    });

    it('isTextLengthValid() should fail if the game name is empty', () => {
        const emptyNameGame = {...getFakeGame(), name: ''};
        expect(() => gameValidatorService.isTextLengthValid(emptyNameGame)).toThrow('["The name field is empty!"]');
    });

    it('isTextLengthValid() should fail if the game name exceeds max length', () => {
        const longNameGame = {...getFakeGame(), name: 'QWERTYUIOPASDFGHJKLZXCVBNM'};
        expect(() => gameValidatorService.isTextLengthValid(longNameGame)).toThrow('["The name field exceeds the maximum length!"]');
    });

    it('isTextLengthValid() should fail if the game desc is empty', () => {
        const emptyDescGame = {...getFakeGame(), description: ''};
        expect(() => gameValidatorService.isTextLengthValid(emptyDescGame)).toThrow('["The description field is empty!"]');
    });

    it('isTextLengthValid() should fail if the game desc is exceeds max length', () => {
        const longDescGame = {...getFakeGame(), description: 'a'.repeat(DESC_MAX_LENGTH + 1)};
        expect(() => gameValidatorService.isTextLengthValid(longDescGame)).toThrow('["The description field exceeds the maximum length!"]');
    });

    it('isGameSurfaceValid() should return true if there is more than 50% walkable tiles', () => {
        expect(gameValidatorService.isGameSurfaceValid(getFakeGame())).toEqual(true);
    });

    it('areAllSpawnPointsPlaced() should return true if all spawn points are placed', () => {
        expect(gameValidatorService.areAllSpawnPointsPlaced(getFakeGame())).toEqual(true);
    });

    it('areAllSpawnPointsPlaced() should fail if not all spawns are placed', () => {
        expect(() => gameValidatorService.areAllSpawnPointsPlaced(invalidGame3)).toThrow('Not all spawn points are placed!');
    });

    it('findFirstWalkableTile() should return the first walkable tile', () => {
        expect(gameValidatorService.findFirstWalkableTile(getFakeGame().grid)).toMatchObject({row:0, col:0});
    });

    it('findFirstWalkableTile() should return null if there is no walkable tile', () => {
        expect(gameValidatorService.findFirstWalkableTile(invalidGame3.grid)).toEqual(null);
    });

    it('isTileValidForPath() should return true if tile isnt surrounded by walls', () => {
        const visited = new Set<string>();
        expect(gameValidatorService.isTileValidForPath(getFakeGame(), 0, 0, visited)).toEqual(true);
    });

    it('isTileValidForPath() should return false if tile is surrounded by walls', () => {
        const game = getFakeGame();
        game.grid[0][0].type = TileTexture.Wall;
        const visited = new Set<string>();
        expect(gameValidatorService.isTileValidForPath(game, 0, 0, visited)).toEqual(false);
    });

    it('isTileValidForPath() should return false for a tile out of bounds', () => {
        const game = getFakeGame();
        const visited = new Set<string>();
        expect(gameValidatorService.isTileValidForPath(game, -1, 0, visited)).toEqual(false);
        expect(gameValidatorService.isTileValidForPath(game, TEN, 0, visited)).toEqual(false);
        expect(gameValidatorService.isTileValidForPath(game, 0, TEN, visited)).toEqual(false);
    });

    it('areThereUnreachableTiles() should return true if all tiles are reachable', () => {
        expect(gameValidatorService.areThereUnreachableTiles(getFakeGame())).toEqual(true);
    });

    it('areThereUnreachableTiles() should fail if there are no walkable tiles', () => {
        expect(() => gameValidatorService.areThereUnreachableTiles(invalidGame3)).toThrow('There are no walkable tiles!');
    });

    it('areThereUnreachableTiles() should fail if there are unreachable tiles', () => {
        const game = getFakeGame();
        game.grid[5][4].type = TileTexture.Wall; // Placing walls around the 5,5 tile.
        game.grid[4][5].type = TileTexture.Wall;
        game.grid[5][6].type = TileTexture.Wall;
        game.grid[6][5].type = TileTexture.Wall;
        expect(() => gameValidatorService.areThereUnreachableTiles(game)).toThrow('One or more tiles are unreachable!');
    });


    it('isDoorsPlacementValid() should return true for valid vertical door', () => {
        const game = getCleanGame();
        game.grid[5][5].type = TileTexture.DoorOpened;
        game.grid[4][5].type = TileTexture.Wall;
        game.grid[6][5].type = TileTexture.Wall;  
        game.grid[5][4].type = TileTexture.Floor;
        game.grid[5][6].type = TileTexture.Floor; 
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should return true for valid horizontal door', () => {
        const game = getCleanGame();
        game.grid[5][5].type = TileTexture.DoorClosed;
        game.grid[5][4].type = TileTexture.Wall;
        game.grid[5][6].type = TileTexture.Wall; 
        game.grid[4][5].type = TileTexture.Floor;
        game.grid[6][5].type = TileTexture.Floor; 
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should throw for door on border', () => {
        const game = getCleanGame();
        game.grid[0][5].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for invalid door placement', () => {
        const game = getCleanGame();
        game.grid[5][5].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for door with walls on wrong sides', () => {
        const game = getCleanGame();
        game.grid[5][5].type = TileTexture.DoorOpened;
        game.grid[4][5].type = TileTexture.Wall; 
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should return true if no doors', () => {
        const game = getCleanGame();
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isFlagPlaced() should return true if flag is placed on CTF gamemode', () => {
        const game = getCleanGame();
        game.gameMode = GameMode.Ctf;
        game.grid[0][0].item = TileItem.Flag;
        expect(gameValidatorService.isFlagPlaced(game)).toEqual(true);
    });

    it('isFlagPlaced() should return false if gamemode is Classic', () => {
        const game = getCleanGame();
        expect(gameValidatorService.isFlagPlaced(game)).toEqual(false);
    });

    it('isFlagPlaced() should fail if flag is not placed in CTF', () => {
        const game = getCleanGame();
        game.gameMode = GameMode.Ctf;
        expect(() => gameValidatorService.isFlagPlaced(game)).toThrow();
    });
});


const getFakeGame = (): CreateGameDto => ({
    name: 'GameName 1',
    description: 'Game Description 1',
    size : { rows: TEN, cols: TEN },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: MIN_PLAYERS,
    grid: defaultGrid,
    isVisible: true,
});

 // cleanGame = grid with only floors for test customization.
const getCleanGame = (): CreateGameDto => ({
    name: 'Clean Game',
    description: 'Test game',
    size: { rows: TEN, cols: TEN },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: 4,
    isVisible: true,
    grid: Array(TEN).fill(null).map(() => 
        Array(TEN).fill(null).map(() => ({ type: TileTexture.Floor, item: null })),
    ),
});

// const BASE_36 = 36;
// const getRandomString = (): string => (Math.random() + 1).toString(BASE_36).substring(2);


// const getRandomInt = (min: number, max: number): number => {
//     return Math.floor(Math.random() * (max - min + 1)) + min;
// };

// const getRandomBoolean = (): boolean => Math.random() < 0.5;


// const randomSize = getRandomInt(10, 20);
// const randomPlayersNb = getRandomInt(2, 6);

const BASE_4 = 4;
const defaultGrid = [
    [
        { type: TileTexture.Floor, item: TileItem.CombatSanctuary }, { type: TileTexture.Floor, item: TileItem.CombatSanctuary }, 
        { type: TileTexture.Floor, item: TileItem.Spawn }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: TileItem.CombatSanctuary }, { type: TileTexture.Floor, item: TileItem.CombatSanctuary }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.DoorOpened, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null}, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },{ type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Wall, item: null }, { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, 
        { type: TileTexture.Floor, item: null },
    ],
    ...Array(BASE_4).fill(Array(TEN).fill({ type: TileTexture.Floor, item: null })),
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Wall, item: null }, 
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, 
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, 
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: TileItem.Spawn }, 
        { type: TileTexture.Floor, item: null },
    ],
];