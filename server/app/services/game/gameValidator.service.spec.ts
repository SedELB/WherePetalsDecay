import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MAX_PLAYERS, TEN, MIN_PLAYERS } from '@app/utils/game.constants';
import { GameMode, TileTexture, TileItem } from '@app/utils/game.enum';
import { Game, GameDocument } from '@app/model/schema/game.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

describe('GameValidator', () => {
    let gameValidatorService: GameValidatorService;
    let validGame1: CreateGameDto;
    let invalidGame3: CreateGameDto;
    let courseModel: Model<GameDocument>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameValidatorService, 
                Logger,
                {
                    // On dit à Nest : "Quand tu cherches le modèle Game, donne cet objet vide"
                    provide: getModelToken(Game.name),
                    useValue: courseModel, 
                },
            ],
        }).compile();

        gameValidatorService = module.get<GameValidatorService>(GameValidatorService);

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
        expect(gameValidatorService.isTextLengthValid(validGame1)).toEqual(true);
    });

    it('isTextLengthValid() should fail if the game name is empty', () => {
        const emptyNameGame = {...validGame1, name: ''};
        expect(() => gameValidatorService.isTextLengthValid(emptyNameGame)).toThrow('[The name field is empty!]');
    });

    it('isTextLengthValid() should fail if the game name exceeds max length', () => {
        const longNameGame = {...validGame1, name: 'QWERTYUIOPASDFGHJKLZXCVBNM'};
        expect(() => gameValidatorService.isTextLengthValid(longNameGame)).toThrow('[The name field exceeds the maximum length!]');
    });

    it('isTextLengthValid() should fail if the game desc is empty', () => {
        const emptyDescGame = {...validGame1, description: ''};
        expect(() => gameValidatorService.isTextLengthValid(emptyDescGame)).toThrow('[The description field is empty!]');
    });

    it('isTextLengthValid() should fail if the game desc is exceeds max length', () => {
        const longDescGame = {...validGame1, description: 'a'.repeat(501)};
        expect(() => gameValidatorService.isTextLengthValid(longDescGame)).toThrow('[The description field exceeds the maximum length!]');
    });

    // it('isGameSurfaceValid() should return true if there is more than 50% walkable tiles', () => {
    //     //...
    // });

    it('areAllSpawnPointsPlaced() should return true if all spawn points are placed', () => {
        expect(gameValidatorService.areAllSpawnPointsPlaced(validGame1)).toEqual(true);
    });

    it('areAllSpawnPointsPlaced() should fail if not all spawns are placed', () => {
        expect(() => gameValidatorService.areAllSpawnPointsPlaced(invalidGame3)).toThrow('Not all spawn points are placed!');
    });

    // it('findFirstWalkableTile() should return the first walkable tile');

    // it('findFirstWalkableTile() should return null if there is no walkable tile');

    // it('isTileValidForPath() should return true if tile isnt surrounded by walls');

    // it('isTileValidForPath() should return false if tile is surrounded by walls');

    // it('areThereUnreachableTiles() should return true if all tiles are reachable');

    // it('areThereUnreachableTiles() should fail if there are no walkable tiles');

    // it('areThereUnreachableTiles() should fail if there are unreachable tiles');

    
});


const getFakeGame = (): CreateGameDto => ({
    name: 'GameName 1',
    description: 'Game Description 1',
    size : { rows: 10, cols: 10 },
    gameMode: GameMode.Classic,
    thumbnail: 'N/A',
    maxPlayers: 6,
    grid: defaultGrid,
    isVisible: true,
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