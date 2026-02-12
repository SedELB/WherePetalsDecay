import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { BASE_10, BASE_15, CUSTOM_GRID_CLASSIC_SMALL, CUSTOM_GRID_CLASSIC_SMALL_INVALID, DESC_MAX_LENGTH } from '@app/utils/game.constants';
import { GameMode, NbPlayersMedium, NbPlayersSmall, TileItem, TileTexture } from '@app/utils/game.enum';
import {
    DESCRIPTION_FIELD_EMPTY,
    DESCRIPTION_FIELD_TOO_LONG,
    FLAG_NOT_PLACED,
    INSUFFICIENT_TERRAIN_TILES,
    NAME_FIELD_EMPTY,
    NAME_FIELD_TOO_LONG,
    NO_TERRAIN_TILES,
    SPAWN_POINTS_NOT_PLACED,
    UNREACHABLE_TILES,
    VALIDATION_ERRORS_PREFIX,
} from '@common/error-messages';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const BASE_5 = 5;

describe('GameValidator', () => {
    let gameValidatorService: GameValidatorService;
    let invalidGame: CreateGameDto;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GameValidatorService, Logger],
        }).compile();

        gameValidatorService = module.get<GameValidatorService>(GameValidatorService);

        invalidGame = {
            name: 'Invalid Game 3',
            description: 'Desc. 3',
            size: { rows: BASE_10, cols: BASE_10 },
            gameMode: GameMode.Classic,
            thumbnail: 'N/A',
            maxPlayers: NbPlayersSmall.MaxPLayers,
            grid: CUSTOM_GRID_CLASSIC_SMALL_INVALID,
            isVisible: true,
        };
    });

    it('should be defined', () => {
        expect(gameValidatorService).toBeDefined();
    });

    it('countByProperty() should return the correct property count for types', () => {
        const result = gameValidatorService.countByProperty(getValidGame(), 'type');
        expect(result).toMatchObject({ ice: 3, floor: 81, wall: 12, doorClosed: 4 });
    });

    it('countByProperty() should return the correct property count for items', () => {
        const result = gameValidatorService.countByProperty(getValidGame(), 'item');
        expect(result).toMatchObject({ spawn: 2 });
    });

    it('isTextLengthValid() should return true if the game name and desc are valid', () => {
        expect(gameValidatorService.isTextLengthValid(getValidGame())).toEqual(true);
    });

    it('isTextLengthValid() should fail if the game name is empty', () => {
        const emptyNameGame = { ...getValidGame(), name: '' };
        expect(() => gameValidatorService.isTextLengthValid(emptyNameGame)).toThrow(NAME_FIELD_EMPTY);
    });

    it('isTextLengthValid() should fail if the game name exceeds max length', () => {
        const longNameGame = { ...getValidGame(), name: 'QWERTYUIOPASDFGHJKLZXCVBNM' };
        expect(() => gameValidatorService.isTextLengthValid(longNameGame)).toThrow(NAME_FIELD_TOO_LONG);
    });

    it('isTextLengthValid() should fail if the game desc is empty', () => {
        const emptyDescGame = { ...getValidGame(), description: '' };
        expect(() => gameValidatorService.isTextLengthValid(emptyDescGame)).toThrow(DESCRIPTION_FIELD_EMPTY);
    });
DESCRIPTION_FIELD_TOO_LONG
    it('isTextLengthValid() should fail if the game desc is exceeds max length', () => {
        const longDescGame = { ...getValidGame(), description: 'a'.repeat(DESC_MAX_LENGTH + 1) };
        expect(() => gameValidatorService.isTextLengthValid(longDescGame)).toThrow(DESCRIPTION_FIELD_TOO_LONG);
    });

    it('isTextLengthValid() should fail with multiple errors', () => {
        const badGame = { ...getValidGame(), name: '', description: '' };
        expect(() => gameValidatorService.isTextLengthValid(badGame)).toThrow();
    });

    it('isGameSurfaceValid() should return true if there is more than 50% walkable tiles', () => {
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(gameValidatorService.isGameSurfaceValid(getValidGame())).toEqual(true);
        expect(spyCountByProperty).toHaveBeenCalledWith(getValidGame(), 'type');
    });

    it('isGameSurfaceValid() should fail if less than 50% walkable', () => {
        const game = getCleanGame();
        for (let i = 0; i < BASE_10; i++) {
            for (let j = 0; j < BASE_15; j++) {
                game.grid[i][j].type = TileTexture.Wall;
            }
        }
        expect(() => gameValidatorService.isGameSurfaceValid(game)).toThrow(INSUFFICIENT_TERRAIN_TILES);
    });

    it('areAllSpawnPointsPlaced() should return true if all spawn points are placed', () => {
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(gameValidatorService.areAllSpawnPointsPlaced(getValidGame())).toEqual(true);
        expect(spyCountByProperty).toHaveBeenCalledWith(getValidGame(), 'item');
    });

    it('areAllSpawnPointsPlaced() should fail if not all spawns are placed', () => {
        expect(() => gameValidatorService.areAllSpawnPointsPlaced(invalidGame)).toThrow(SPAWN_POINTS_NOT_PLACED);
    });

    it('findFirstWalkableTile() should return the first walkable tile', () => {
        expect(gameValidatorService.findFirstWalkableTile(getValidGame().grid)).toMatchObject({ row: 0, col: 2 });
    });

    it('findFirstWalkableTile() should return null if there is no walkable tile', () => {
        expect(gameValidatorService.findFirstWalkableTile(invalidGame.grid)).toEqual(null);
    });

    it('getObjectsPositions() should return all door positions', () => {
        const positions = gameValidatorService.getObjectsPositions(getValidGame(), 'door');
        expect(positions.length).toBeGreaterThan(0);
        expect(positions[0]).toHaveProperty('row');
        expect(positions[0]).toHaveProperty('col');
    });

    it('getObjectsPositions() should return spawn positions', () => {
        const positions = gameValidatorService.getObjectsPositions(getValidGame(), TileItem.Spawn);
        expect(positions.length).toEqual(2);
    });

    it('getObjectsPositions() should return empty array for empty grid', () => {
        const emptyGame = { ...getCleanGame(), grid: [] };
        expect(gameValidatorService.getObjectsPositions(emptyGame, 'door')).toEqual([]);
    });

    it('getObjectsPositions() should return empty array when object not found', () => {
        const positions = gameValidatorService.getObjectsPositions(getCleanGame(), 'door');
        expect(positions).toEqual([]);
    });

    it('isTileValidForPath() should return true if tile isnt surrounded by walls', () => {
        const visited = new Set<string>();
        expect(gameValidatorService.isTileValidForPath(getValidGame(), 0, 2, visited)).toEqual(true);
    });

    it('isTileValidForPath() should return false if tile is surrounded by walls', () => {
        const game = getValidGame();
        game.grid[0][0].type = TileTexture.Wall;
        const visited = new Set<string>();
        expect(gameValidatorService.isTileValidForPath(game, 0, 0, visited)).toEqual(false);
    });

    it('isTileValidForPath() should return false for a tile out of bounds', () => {
        const game = getValidGame();
        const visited = new Set<string>();
        expect(gameValidatorService.isTileValidForPath(game, -1, 0, visited)).toEqual(false);
        expect(gameValidatorService.isTileValidForPath(game, BASE_10, 0, visited)).toEqual(false);
        expect(gameValidatorService.isTileValidForPath(game, 0, BASE_10, visited)).toEqual(false);
    });

    it('areThereUnreachableTiles() should return true if all tiles are reachable', () => {
        const spyFindFirstWalkableTile = jest.spyOn(gameValidatorService, 'findFirstWalkableTile');
        const spyCountByProperty = jest.spyOn(gameValidatorService, 'countByProperty');
        expect(gameValidatorService.areThereUnreachableTiles(getValidGame())).toEqual(true);
        expect(spyFindFirstWalkableTile).toHaveBeenCalledWith(getValidGame().grid);
        expect(spyCountByProperty).toHaveBeenCalledWith(getValidGame(), 'type');
    });

    it('areThereUnreachableTiles() should fail if there are no walkable tiles', () => {
        expect(() => gameValidatorService.areThereUnreachableTiles(invalidGame)).toThrow(NO_TERRAIN_TILES);
    });

    it('areThereUnreachableTiles() should fail if there are unreachable tiles', () => {
        const game = getValidGame();
        game.grid[BASE_5][4].type = TileTexture.Wall; // Placing walls around the FIVE,FIVE tile.
        game.grid[4][BASE_5].type = TileTexture.Wall;
        game.grid[BASE_5][6].type = TileTexture.Wall;
        game.grid[6][BASE_5].type = TileTexture.Wall;
        expect(() => gameValidatorService.areThereUnreachableTiles(game)).toThrow(UNREACHABLE_TILES);
    });


    it('isDoorsPlacementValid() should return true for valid vertical door', () => {
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorOpened;
        game.grid[4][BASE_5].type = TileTexture.Wall;
        game.grid[6][BASE_5].type = TileTexture.Wall;
        game.grid[BASE_5][4].type = TileTexture.Floor;
        game.grid[BASE_5][6].type = TileTexture.Floor;
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should return true for valid horizontal door', () => {
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorClosed;
        game.grid[BASE_5][4].type = TileTexture.Wall;
        game.grid[BASE_5][6].type = TileTexture.Wall;
        game.grid[4][BASE_5].type = TileTexture.Floor;
        game.grid[6][BASE_5].type = TileTexture.Floor;
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should throw for door on border', () => {
        const game = getCleanGame();
        game.grid[0][BASE_5].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for invalid door placement', () => {
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for door with walls on wrong sides', () => {
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorOpened;
        game.grid[4][BASE_5].type = TileTexture.Wall;
        expect(() => gameValidatorService.isDoorsPlacementValid(game)).toThrow();
    });

    it('isDoorsPlacementValid() should return true if no doors', () => {
        const game = getCleanGame();
        const spyGetObjectsPositions = jest.spyOn(gameValidatorService, 'getObjectsPositions');
        expect(gameValidatorService.isDoorsPlacementValid(game)).toEqual(true);
        expect(spyGetObjectsPositions).toHaveBeenCalledWith(game, 'door');
    });

    it('isDoorOnGridBorder() should return true for door inside grid', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getValidGame().grid, BASE_5, BASE_5)).toEqual(true);
    });

    it('isDoorOnGridBorder() should return false for door on top border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getValidGame().grid, 0, BASE_5)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on bottom border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getValidGame().grid, BASE_10 - 1, BASE_5)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on left border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getValidGame().grid, BASE_5, 0)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on right border', () => {
        expect(gameValidatorService.isDoorOnGridBorder(getValidGame().grid, BASE_5, BASE_10 - 1)).toEqual(false);
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
        expect(() => gameValidatorService.isFlagPlaced(game)).toThrow(FLAG_NOT_PLACED);
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
            ...invalidGame,
            name: '',
            description: '',
        };
        expect(() => gameValidatorService.isGameValid(invalidGameMultiple)).toThrow(VALIDATION_ERRORS_PREFIX);
    });

    it('isGameValid() should handle single validation error', () => {
        const game = getCleanGame();
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Spawn;
        game.grid[1][0].item = TileItem.Spawn;
        game.grid[1][1].item = TileItem.Spawn;
        game.name = '';
        expect(() => gameValidatorService.isGameValid(game)).toThrow(VALIDATION_ERRORS_PREFIX);
    });

    it('isGameValid() should catch all validation errors in one call', () => {
        const spyIsTextLengthValid = jest.spyOn(gameValidatorService, 'isTextLengthValid');
        const spyIsGameSurfaceValid = jest.spyOn(gameValidatorService, 'isGameSurfaceValid');

        try {
            gameValidatorService.isGameValid(invalidGame);
        } catch (error) {
            expect(error.message).toContain(VALIDATION_ERRORS_PREFIX);
        }

        expect(spyIsTextLengthValid).toHaveBeenCalled();
        expect(spyIsGameSurfaceValid).toHaveBeenCalled();
    });
});

const getValidGame = (): CreateGameDto => ({
    name: 'GameName 1',
    description: 'Game Description 1',
    size: { rows: BASE_10, cols: BASE_10 },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: NbPlayersSmall.MaxPLayers,
    grid: CUSTOM_GRID_CLASSIC_SMALL,
    isVisible: true,
});

// cleanGame = grid with only floors for in-test customization.
const getCleanGame = (): CreateGameDto => ({
    name: 'Clean Game',
    description: 'Test game',
    size: { rows: BASE_15, cols: BASE_15 },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: NbPlayersMedium.MaxPLayers,
    isVisible: true,
    grid: Array(BASE_15).fill(null).map(() =>
        Array(BASE_15).fill(null).map(() => ({ type: TileTexture.Floor, item: null })),
    ),
});
