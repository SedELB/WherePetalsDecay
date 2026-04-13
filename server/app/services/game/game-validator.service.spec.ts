import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from '@app/services/game/game-validator.service';
import { BASE_10, BASE_15, CUSTOM_GRID_CLASSIC_SMALL, CUSTOM_GRID_CLASSIC_SMALL_INVALID, DESC_MAX_LENGTH } from '@app/utils/game.constants';
import { GameMode, MaxPlayers, TileItem, TileTexture } from '@common/enums';
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
            maxPlayers: MaxPlayers.Small,
            grid: CUSTOM_GRID_CLASSIC_SMALL_INVALID,
            isVisible: true,
        };
    });

    it('should be defined', () => {
        // Ensures GameValidatorService instance is properly created
        expect(gameValidatorService).toBeDefined();
    });

    it('countByProperty() should return the correct property count for types', () => {
        // Counts specific tile types (wall, floor, ice, etc) in grid
        const result = gameValidatorService['countByProperty'](getValidGame(), 'type');
        expect(result).toMatchObject({ ice: 3, floor: 81, wall: 12, doorClosed: 4 });
    });

    it('countByProperty() should return the correct property count for items', () => {
        // Counts placed items (spawn points, flags, etc) in grid
        const result = gameValidatorService['countByProperty'](getValidGame(), 'item');
        expect(result).toMatchObject({ spawn: 2 });
    });

    it('isTextLengthValid() should return true if the game name and desc are valid', () => {
        // Validates game name and description meet length requirements
        expect(gameValidatorService['isTextLengthValid'](getValidGame())).toEqual(true);
    });

    it('isTextLengthValid() should fail if the game name is empty', () => {
        // Rejects games with empty name field
        const emptyNameGame = { ...getValidGame(), name: '' };
        expect(() => gameValidatorService['isTextLengthValid'](emptyNameGame)).toThrow(NAME_FIELD_EMPTY);
    });

    it('isTextLengthValid() should fail if the game name exceeds max length', () => {
        // Rejects game names that exceed character limit
        const longNameGame = { ...getValidGame(), name: 'QWERTYUIOPASDFGHJKLZXCVBNM' };
        expect(() => gameValidatorService['isTextLengthValid'](longNameGame)).toThrow(NAME_FIELD_TOO_LONG);
    });

    it('isTextLengthValid() should fail if the game desc is empty', () => {
        // Rejects games with empty description field
        const emptyDescGame = { ...getValidGame(), description: '' };
        expect(() => gameValidatorService['isTextLengthValid'](emptyDescGame)).toThrow(DESCRIPTION_FIELD_EMPTY);
    });

    it('isTextLengthValid() should fail if the game desc is exceeds max length', () => {
        // Rejects descriptions that exceed character limit
        const longDescGame = { ...getValidGame(), description: 'a'.repeat(DESC_MAX_LENGTH + 1) };
        expect(() => gameValidatorService['isTextLengthValid'](longDescGame)).toThrow(DESCRIPTION_FIELD_TOO_LONG);
    });

    it('isTextLengthValid() should fail with multiple errors', () => {
        // Collects multiple validation errors in single pass
        const badGame = { ...getValidGame(), name: '', description: '' };
        expect(() => gameValidatorService['isTextLengthValid'](badGame)).toThrow();
    });

    it('isGameSurfaceValid() should return true if there is more than 50% walkable tiles', () => {
        // Ensures game map has sufficient walkable terrain
        const spyCountByProperty = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'countByProperty');
        expect(gameValidatorService['isGameSurfaceValid'](getValidGame())).toEqual(true);
        expect(spyCountByProperty).toHaveBeenCalledWith(getValidGame(), 'type');
    });

    it('isGameSurfaceValid() should fail if less than 50% walkable', () => {
        // Rejects maps with insufficient playable space
        const game = getCleanGame();
        for (let i = 0; i < BASE_10; i++) {
            for (let j = 0; j < BASE_15; j++) {
                game.grid[i][j].type = TileTexture.Wall;
            }
        }
        expect(() => gameValidatorService['isGameSurfaceValid'](game)).toThrow(INSUFFICIENT_TERRAIN_TILES);
    });

    it('areAllSpawnPointsPlaced() should return true if all spawn points are placed', () => {
        // Confirms all required spawn points are placed on map
        const spyCountByProperty = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'countByProperty');
        expect(gameValidatorService['areAllSpawnPointsPlaced'](getValidGame())).toEqual(true);
        expect(spyCountByProperty).toHaveBeenCalledWith(getValidGame(), 'item');
    });

    it('areAllSpawnPointsPlaced() should fail if not all spawns are placed', () => {
        // Rejects games without sufficient spawn points for all players
        expect(() => gameValidatorService['areAllSpawnPointsPlaced'](invalidGame)).toThrow(SPAWN_POINTS_NOT_PLACED);
    });

    it('findFirstWalkableTile() should return the first walkable tile', () => {
        // Locates starting position for pathfinding algorithm
        expect(gameValidatorService['findFirstWalkableTile'](getValidGame().grid)).toMatchObject({ y: 0, x: 2 });
    });

    it('findFirstWalkableTile() should return null if there is no walkable tile', () => {
        // Returns null when map has no accessible tiles
        expect(gameValidatorService['findFirstWalkableTile'](invalidGame.grid)).toEqual(null);
    });

    it('getObjectsPositions() should return all door positions', () => {
        // Retrieves coordinates of all doors on map
        const positions = gameValidatorService['getObjectsPositions'](getValidGame(), 'door');
        expect(positions.length).toBeGreaterThan(0);
        expect(positions[0]).toHaveProperty('y');
        expect(positions[0]).toHaveProperty('x');
    });

    it('getObjectsPositions() should return spawn positions', () => {
        // Retrieves all spawn point coordinates
        const positions = gameValidatorService['getObjectsPositions'](getValidGame(), TileItem.Spawn);
        expect(positions.length).toEqual(2);
    });

    it('getObjectsPositions() should return empty array for empty grid', () => {
        // Returns empty list when grid contains no tiles
        const emptyGame = { ...getCleanGame(), grid: [] };
        expect(gameValidatorService['getObjectsPositions'](emptyGame, 'door')).toEqual([]);
    });

    it('getObjectsPositions() should return empty array when object not found', () => {
        // Returns empty list when search object type doesn't exist on map
        const positions = gameValidatorService['getObjectsPositions'](getCleanGame(), 'door');
        expect(positions).toEqual([]);
    });

    it('isTileValidForPath() should return true if tile isnt surrounded by walls', () => {
        // Determines if a game tile can be walked by checking it's not a wall and is in bounds
        const visited = new Set<string>();
        expect(gameValidatorService['isTileValidForPath'](getValidGame(), 0, 2, visited)).toEqual(true);
    });

    it('isTileValidForPath() should return false if tile is surrounded by walls', () => {
        // Returns false when the tile is a wall type
        const game = getValidGame();
        game.grid[0][0].type = TileTexture.Wall;
        const visited = new Set<string>();
        expect(gameValidatorService['isTileValidForPath'](game, 0, 0, visited)).toEqual(false);
    });

    it('isTileValidForPath() should return false for a tile out of bounds', () => {
        // Rejects tiles outside the grid boundaries (negative or exceeds grid size)
        const game = getValidGame();
        const visited = new Set<string>();
        expect(gameValidatorService['isTileValidForPath'](game, -1, 0, visited)).toEqual(false);
        expect(gameValidatorService['isTileValidForPath'](game, BASE_10, 0, visited)).toEqual(false);
        expect(gameValidatorService['isTileValidForPath'](game, 0, BASE_10, visited)).toEqual(false);
    });

    it('areThereUnreachableTiles() should return true if all tiles are reachable', () => {
        // Validates that all walkable tiles are reachable via breadth-first search from starting position
        const spyFindFirstWalkableTile = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'findFirstWalkableTile');
        const spyCountByProperty = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'countByProperty');
        expect(gameValidatorService['areThereUnreachableTiles'](getValidGame())).toEqual(true);
        expect(spyFindFirstWalkableTile).toHaveBeenCalledWith(getValidGame().grid);
        expect(spyCountByProperty).toHaveBeenCalledWith(getValidGame(), 'type');
    });

    it('areThereUnreachableTiles() should fail if there are no walkable tiles', () => {
        // Throws error when grid contains only walls with no floor tiles for movement
        expect(() => gameValidatorService['areThereUnreachableTiles'](invalidGame)).toThrow(NO_TERRAIN_TILES);
    });

    it('areThereUnreachableTiles() should fail if there are unreachable tiles', () => {
        // Detects when walkable tiles exist but are isolated from starting position by walls
        const game = getValidGame();
        game.grid[BASE_5][4].type = TileTexture.Wall; // Placing walls around the FIVE,FIVE tile.
        game.grid[4][BASE_5].type = TileTexture.Wall;
        game.grid[BASE_5][6].type = TileTexture.Wall;
        game.grid[6][BASE_5].type = TileTexture.Wall;
        expect(() => gameValidatorService['areThereUnreachableTiles'](game)).toThrow(UNREACHABLE_TILES);
    });


    it('isDoorsPlacementValid() should return true for valid vertical door', () => {
        // Validates doors with walls on top and bottom, floors on left and right (vertical orientation)
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorOpened;
        game.grid[4][BASE_5].type = TileTexture.Wall;
        game.grid[6][BASE_5].type = TileTexture.Wall;
        game.grid[BASE_5][4].type = TileTexture.Floor;
        game.grid[BASE_5][6].type = TileTexture.Floor;
        expect(gameValidatorService['isDoorsPlacementValid'](game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should return true for valid horizontal door', () => {
        // Validates doors with walls on left and right, floors on top and bottom (horizontal orientation)
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorClosed;
        game.grid[BASE_5][4].type = TileTexture.Wall;
        game.grid[BASE_5][6].type = TileTexture.Wall;
        game.grid[4][BASE_5].type = TileTexture.Floor;
        game.grid[6][BASE_5].type = TileTexture.Floor;
        expect(gameValidatorService['isDoorsPlacementValid'](game)).toEqual(true);
    });

    it('isDoorsPlacementValid() should throw for door on border', () => {
        // Rejects doors placed on grid borders (insufficient space for required adjacent walls/floors)
        const game = getCleanGame();
        game.grid[0][BASE_5].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService['isDoorsPlacementValid'](game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for invalid door placement', () => {
        // Rejects doors surrounded by all floor tiles without required wall barriers for proper orientation
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorOpened;
        expect(() => gameValidatorService['isDoorsPlacementValid'](game)).toThrow();
    });

    it('isDoorsPlacementValid() should throw for door with walls on wrong sides', () => {
        // Detects invalid symmetry: wall only on one side when both sides must have matching orientation
        const game = getCleanGame();
        game.grid[BASE_5][BASE_5].type = TileTexture.DoorOpened;
        game.grid[4][BASE_5].type = TileTexture.Wall;
        expect(() => gameValidatorService['isDoorsPlacementValid'](game)).toThrow();
    });

    it('isDoorsPlacementValid() should return true if no doors', () => {
        // Passes validation when no doors exist on map (no placement rules to enforce)
        const game = getCleanGame();
        const spyGetObjectsPositions = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'getObjectsPositions');
        expect(gameValidatorService['isDoorsPlacementValid'](game)).toEqual(true);
        expect(spyGetObjectsPositions).toHaveBeenCalledWith(game, 'door');
    });

    it('isDoorOnGridBorder() should return true for door inside grid', () => {
        // Returns true when door is positioned away from all grid edges (safe placement)
        expect(gameValidatorService['isDoorOnGridBorder'](getValidGame().grid, BASE_5, BASE_5)).toEqual(true);
    });

    it('isDoorOnGridBorder() should return false for door on top border', () => {
        // Detects doors on the top edge (row index 0) of the grid
        expect(gameValidatorService['isDoorOnGridBorder'](getValidGame().grid, 0, BASE_5)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on bottom border', () => {
        // Detects doors on the bottom edge (last row index) of the grid
        expect(gameValidatorService['isDoorOnGridBorder'](getValidGame().grid, BASE_10 - 1, BASE_5)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on left border', () => {
        // Detects doors on the left edge (column index 0) of the grid
        expect(gameValidatorService['isDoorOnGridBorder'](getValidGame().grid, BASE_5, 0)).toEqual(false);
    });

    it('isDoorOnGridBorder() should return false for door on right border', () => {
        // Detects doors on the right edge (last column index) of the grid
        expect(gameValidatorService['isDoorOnGridBorder'](getValidGame().grid, BASE_5, BASE_10 - 1)).toEqual(false);
    });

    it('isFlagPlaced() should return true if flag is placed on CTF gamemode', () => {
        // Validates that flag exists on the map when game mode is Capture The Flag
        const game = getCleanGame();
        game.gameMode = GameMode.Ctf;
        game.grid[0][0].item = TileItem.Flag;
        expect(gameValidatorService['isFlagPlaced'](game)).toEqual(true);
    });

    it('isFlagPlaced() should return false if gamemode is Classic', () => {
        // Skips flag validation for Classic game mode (flags not required)
        const game = getCleanGame();
        expect(gameValidatorService['isFlagPlaced'](game)).toEqual(false);
    });

    it('isFlagPlaced() should fail if flag is not placed in CTF', () => {
        // Throws error when CTF mode is selected but no flag item exists on any grid tile
        const game = getCleanGame();
        game.gameMode = GameMode.Ctf;
        const spyCountByProperty = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'countByProperty');
        expect(() => gameValidatorService['isFlagPlaced'](game)).toThrow(FLAG_NOT_PLACED);
        expect(spyCountByProperty).toHaveBeenCalledWith(game, 'item');
    });

    it('isGameValid() should return true for a valid game', () => {
        // Comprehensive game validation: checks text, surface, doors, reachability, spawn points, and flags
        const validGame = getCleanGame();
        validGame.grid[0][0].item = TileItem.Spawn;
        validGame.grid[0][1].item = TileItem.Spawn;
        validGame.grid[1][0].item = TileItem.Spawn;
        validGame.grid[1][1].item = TileItem.Spawn;
        validGame.grid[0][2].item = TileItem.HealingSanctuary;
        validGame.grid[2][2].item = TileItem.HealingSanctuary;
        validGame.grid[0][4].item = TileItem.CombatSanctuary;
        validGame.grid[2][4].item = TileItem.CombatSanctuary;

        const spyIsTextLengthValid = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'isTextLengthValid');
        const spyIsDoorsPlacementValid = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'isDoorsPlacementValid');
        const spyAreThereUnreachableTiles = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'areThereUnreachableTiles');
        const spyIsGameSurfaceValid = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'isGameSurfaceValid');
        const spyAreAllSpawnPointsPlaced = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'areAllSpawnPointsPlaced');
        const spyIsFlagPlaced = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'isFlagPlaced');

        expect(gameValidatorService.isGameValid(validGame)).toEqual(true);
        expect(spyIsTextLengthValid).toHaveBeenCalled();
        expect(spyIsDoorsPlacementValid).toHaveBeenCalled();
        expect(spyAreThereUnreachableTiles).toHaveBeenCalled();
        expect(spyIsGameSurfaceValid).toHaveBeenCalled();
        expect(spyAreAllSpawnPointsPlaced).toHaveBeenCalled();
        expect(spyIsFlagPlaced).toHaveBeenCalled();
    });

    it('isGameValid() should throw with multiple validation errors', () => {
        // Collects and reports all validation failures at once
        const invalidGameMultiple = {
            ...invalidGame,
            name: '',
            description: '',
        };
        expect(() => gameValidatorService.isGameValid(invalidGameMultiple)).toThrow(NAME_FIELD_EMPTY);
    });

    it('isGameValid() should handle single validation error', () => {
        // Throws with the specific error message when only one problem exists (e.g., empty name)
        const game = getCleanGame();
        game.grid[0][0].item = TileItem.Spawn;
        game.grid[0][1].item = TileItem.Spawn;
        game.grid[1][0].item = TileItem.Spawn;
        game.grid[1][1].item = TileItem.Spawn;
        game.name = '';
        expect(() => gameValidatorService.isGameValid(game)).toThrow(NAME_FIELD_EMPTY);
    });

    it('isGameValid() should catch all validation errors in one call', () => {
        // Ensures all validation checks complete before throwing, not stopping at first error
        const spyIsTextLengthValid = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'isTextLengthValid');
        const spyIsGameSurfaceValid = jest.spyOn(gameValidatorService as object as Record<string, jest.Mock>, 'isGameSurfaceValid');

        try {
            gameValidatorService.isGameValid(invalidGame);
        } catch (error) {
            expect(error.message).toContain(NO_TERRAIN_TILES);
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
    maxPlayers: MaxPlayers.Small,
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
    maxPlayers: MaxPlayers.Medium,
    isVisible: true,
    grid: Array(BASE_15).fill(null).map(() =>
        Array(BASE_15).fill(null).map(() => ({ type: TileTexture.Floor, item: null })),
    ),
});
