import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TEN, MIN_PLAYERS, DESC_MAX_LENGTH, MAX_PLAYERS } from '@app/utils/game.constants';
import { GameMode, TileTexture, TileItem } from '@app/utils/game.enum';
const FIVE = 5;
const EIGHT = 8;

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

    it('generateValidGrid() should create grid with correct dimensions', () => {
        const grid = gameValidatorService.generateValidGrid(FIVE, EIGHT);
        expect(grid.length).toEqual(FIVE);
        expect(grid[0].length).toEqual(EIGHT);
    });

    it('generateValidGrid() should place correct number of spawns', () => {
        const grid = gameValidatorService.generateValidGrid(TEN, TEN);
        const spawns = grid.flat().filter(tile => tile.item === TileItem.Spawn);
        expect(spawns.length).toEqual(MAX_PLAYERS);
    });

    it('generateInvalidGrid() should create grid with correct dimensions', () => {
        const grid = gameValidatorService.generateInvalidGrid(FIVE, FIVE);
        expect(grid.length).toEqual(FIVE);
        expect(grid[0].length).toEqual(FIVE);
    });

    it('generateInvalidGrid() should create grid with only walls', () => {
        const grid = gameValidatorService.generateInvalidGrid(FIVE, FIVE);
        const allWalls = grid.flat().every(tile => tile.type === TileTexture.Wall);
        expect(allWalls).toEqual(true);
    });

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

    it('isTextLengthValid() should fail with multiple errors', () => {
        const badGame = {...getFakeGame(), name: '', description: ''};
        expect(() => gameValidatorService.isTextLengthValid(badGame)).toThrow();
    });

    it('isGameSurfaceValid() should return true if there is more than 50% walkable tiles', () => {
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(gameValidatorService.isGameSurfaceValid(getFakeGame())).toEqual(true);
        expect(spyCountByProperty).toHaveBeenCalledWith(getFakeGame(), 'type');
    });

    it('isGameSurfaceValid() should fail if less than 50% walkable', () => {
        const game = getCleanGame();
        for (let i = 0; i < EIGHT; i++) {
            for (let j = 0; j < TEN; j++) {
                game.grid[i][j].type = TileTexture.Wall;
            }
        }
        expect(() => gameValidatorService.isGameSurfaceValid(game)).toThrow('Less than 50% of tiles are walkable!');
    });

    it('areAllSpawnPointsPlaced() should return true if all spawn points are placed', () => {
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(gameValidatorService.areAllSpawnPointsPlaced(getFakeGame())).toEqual(true);
        expect(spyCountByProperty).toHaveBeenCalledWith(getFakeGame(), 'item');
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

    it('getObjectsPositions() should return all door positions', () => {
        const positions = gameValidatorService.getObjectsPositions(getFakeGame(), 'door');
        expect(positions.length).toBeGreaterThan(0);
        expect(positions[0]).toHaveProperty('row');
        expect(positions[0]).toHaveProperty('col');
    });

    it('getObjectsPositions() should return spawn positions', () => {
        const positions = gameValidatorService.getObjectsPositions(getFakeGame(), TileItem.Spawn);
        expect(positions.length).toEqual(2);
    });

    it('getObjectsPositions() should return empty array for empty grid', () => {
        const emptyGame = {...getCleanGame(), grid: []};
        expect(gameValidatorService.getObjectsPositions(emptyGame, 'door')).toEqual([]);
    });

    it('getObjectsPositions() should return empty array when object not found', () => {
        const positions = gameValidatorService.getObjectsPositions(getCleanGame(), 'door');
        expect(positions).toEqual([]);
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
        const spyFindFirstWalkableTile = jest.spyOn(gameValidatorService, 'findFirstWalkableTile');
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(gameValidatorService.areThereUnreachableTiles(getFakeGame())).toEqual(true);
        expect(spyFindFirstWalkableTile).toHaveBeenCalledWith(getFakeGame().grid);
        expect(spyCountByProperty).toHaveBeenCalledWith(getFakeGame(), 'type');
    });

    it('areThereUnreachableTiles() should fail if there are no walkable tiles', () => {
        expect(() => gameValidatorService.areThereUnreachableTiles(invalidGame3)).toThrow('There are no walkable tiles!');
    });

    it('areThereUnreachableTiles() should fail if there are unreachable tiles', () => {
        const game = getFakeGame();
        game.grid[FIVE][4].type = TileTexture.Wall; // Placing walls around the FIVE,FIVE tile.
        game.grid[4][FIVE].type = TileTexture.Wall;
        game.grid[FIVE][6].type = TileTexture.Wall;
        game.grid[6][FIVE].type = TileTexture.Wall;
        expect(() => gameValidatorService.areThereUnreachableTiles(game)).toThrow('One or more tiles are unreachable!');
    });


    it('isDoorsPlacementValid() should return true for valid vertical door', () => {
        const game = getCleanGame();
        game.grid[FIVE][FIVE].type = TileTexture.DoorOpened;
        game.grid[4][FIVE].type = TileTexture.Wall;
        game.grid[6][FIVE].type = TileTexture.Wall;  
        game.grid[FIVE][4].type = TileTexture.Floor;
        game.grid[FIVE][6].type = TileTexture.Floor; 
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should return true for valid horizontal door', () => {
        const game = getCleanGame();
        game.grid[FIVE][FIVE].type = TileTexture.DoorClosed;
        game.grid[FIVE][4].type = TileTexture.Wall;
        game.grid[FIVE][6].type = TileTexture.Wall; 
        game.grid[4][FIVE].type = TileTexture.Floor;
        game.grid[6][FIVE].type = TileTexture.Floor; 
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should throw for door on border', () => {
        const game = getCleanGame();
        game.grid[0][FIVE].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for invalid door placement', () => {
        const game = getCleanGame();
        game.grid[FIVE][FIVE].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for door with walls on wrong sides', () => {
        const game = getCleanGame();
        game.grid[FIVE][FIVE].type = TileTexture.DoorOpened;
        game.grid[4][FIVE].type = TileTexture.Wall; 
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should return true if no doors', () => {
        const game = getCleanGame();
        const spyGetObjectsPositions = jest.spyOn(gameValidatorService, 'getObjectsPositions');
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
        expect(spyGetObjectsPositions).toHaveBeenCalledWith(game, 'door');
    });

    it('isDoorOnGridBorder() should return true for door inside grid', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getFakeGame().grid, FIVE, FIVE)).toEqual(true);
    });

    it('isDoorOnGridBorder() should return false for door on top border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getFakeGame().grid, 0, FIVE)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on bottom border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getFakeGame().grid, TEN - 1, FIVE)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on left border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getFakeGame().grid, FIVE, 0)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on right border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getFakeGame().grid, FIVE, TEN - 1)).toEqual(false);
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
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(() => gameValidatorService.isFlagPlaced(game)).toThrow("The Flag isn't placed!");
        expect(spyCountByProperty).toHaveBeenCalledWith(game, 'item');
    });

    it('isGameValid() should return true for a valid game', () => {
        const validGame = getCleanGame();
        validGame.grid[0][0].item = TileItem.Spawn;
        validGame.grid[0][1].item = TileItem.Spawn;
        validGame.grid[1][0].item = TileItem.Spawn;
        validGame.grid[1][1].item = TileItem.Spawn;

        const spyIsTextLengthValid = jest.spyOn(gameValidatorService, 'isTextLengthValid');
        const spyIsDoorsPlacementValid = jest.spyOn(gameValidatorService, 'isDoorsPlacementValid');
        const spyAreThereUnreachableTiles = jest.spyOn(gameValidatorService, 'areThereUnreachableTiles');
        const spyIsGameSurfaceValid = jest.spyOn(gameValidatorService, 'isGameSurfaceValid');
        const spyAreAllSpawnPointsPlaced = jest.spyOn(gameValidatorService, 'areAllSpawnPointsPlaced');
        const spyIsFlagPlaced = jest.spyOn(gameValidatorService, 'isFlagPlaced');
        
        expect(gameValidatorService.isGameValid(validGame)).toEqual(true);
        expect(spyIsTextLengthValid).toHaveBeenCalled();
        expect(spyIsDoorsPlacementValid).toHaveBeenCalled();
        expect(spyAreThereUnreachableTiles).toHaveBeenCalled();
        expect(spyIsGameSurfaceValid).toHaveBeenCalled();
        expect(spyAreAllSpawnPointsPlaced).toHaveBeenCalled();
        expect(spyIsFlagPlaced).toHaveBeenCalled();
    });

    it('isGameValid() should throw with multiple validation errors', () => {
        const invalidGameMultiple = {
            ...invalidGame3,
            name: '',
            description: '',
        };
        expect(() => gameValidatorService.isGameValid(invalidGameMultiple)).toThrow('Validation errors:');
    });

    it('isGameValid() should handle single validation error', () => {
        const game = getCleanGame();
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Spawn;
        game.grid[1][0].item = TileItem.Spawn;
        game.grid[1][1].item = TileItem.Spawn;
        game.name = '';
        expect(() => gameValidatorService.isGameValid(game)).toThrow('Validation errors:');
    });

    it('isGameValid() should catch all validation errors in one call', () => {
        const spyIsTextLengthValid = jest.spyOn(gameValidatorService, 'isTextLengthValid');
        const spyIsGameSurfaceValid = jest.spyOn(gameValidatorService, 'isGameSurfaceValid');
        
        try {
            gameValidatorService.isGameValid(invalidGame3);
        } catch (error) {
            expect(error.message).toContain('Validation errors:');
        }
        
        expect(spyIsTextLengthValid).toHaveBeenCalled();
        expect(spyIsGameSurfaceValid).toHaveBeenCalled();
    });
});


const getFakeGame = (): CreateGameDto => ({
    name: 'GameName 1',
    description: 'Game Description 1',
    size : { rows: TEN, cols: TEN },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: MIN_PLAYERS,
    grid: customGrid,
    isVisible: true,
});

 // cleanGame = grid with only floors for in-test customization.
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

const BASE_4 = 4;

// Custom Grid made in a Excel file to be able to count properties.
const customGrid = [
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