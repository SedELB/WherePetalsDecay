import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CommunicationService } from '@app/services/communication.service';
import { GameValidatorService } from '@app/services/game-validator.service';
import { MapSetupFacadeService } from '@app/services/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count.service';

import type { Game } from '@app/interfaces/game';
import type { Tile } from '@app/interfaces/tile';
import { GameMode, TileTexture } from '@common/enums';

const grid = (rows: number, cols: number): Tile[][] =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            type: TileTexture.Floor,
            item: null,
        })),
    );

const SIZE_SMALL = 10;
const THUMBNAIL_SIZE_PX = 10;
const CAPTURE_TEST_SEED = 'test';

type CaptureThumbnailApi = {
    captureThumbnail: (seed: string) => Promise<string>;
};

const gameFactory = (rows = 2, cols = 2, mode: GameMode = GameMode.Classic): Game => ({
    _id: 'game-id',
    name: 'Test Game',
    description: 'Desc',
    size: { rows, cols },
    gameMode: mode,
    thumbnail: 'thumb',
    maxPlayers: 4,
    grid: grid(rows, cols),
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe('MapSetupFacadeService', () => {
    let router: jasmine.SpyObj<Router>;
    let communication: jasmine.SpyObj<CommunicationService>;
    let validator: jasmine.SpyObj<GameValidatorService>;
    let mapSetup: jasmine.SpyObj<MapSetupService>;
    let tileItemCount: jasmine.SpyObj<TileItemCountService>;
    let service: MapSetupFacadeService;

    beforeEach(() => {
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        communication = jasmine.createSpyObj<CommunicationService>('CommunicationService', [
            'createGame',
            'modifyGame',
            'getAllGames',
        ]);
        validator = jasmine.createSpyObj<GameValidatorService>('GameValidatorService', ['validate']);
        mapSetup = jasmine.createSpyObj<MapSetupService>('MapSetupService', [
            'initializeGridIfEmpty',
            'buildValidationPayload',
        ]);
        tileItemCount = jasmine.createSpyObj<TileItemCountService>('TileItemCountService', [
            'createRequiredCounts',
            'adjustCountsForExistingItems',
        ]);

        service = new MapSetupFacadeService(
            router,
            communication,
            validator,
            mapSetup as unknown as MapSetupService,
            tileItemCount as unknown as TileItemCountService,
        );
    });

    it('reads the game from navigation state and prepares item counts', () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const counts = { spawnCount: 2, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 0 };

        history.pushState({ game, mode: 'edit' }, '', '');
        tileItemCount.createRequiredCounts.and.returnValue(counts);

        const result = service.initializeFromNavigation();

        expect(mapSetup.initializeGridIfEmpty).toHaveBeenCalledWith(game);
        expect(tileItemCount.adjustCountsForExistingItems).toHaveBeenCalledWith(game, counts);
        expect(result).toEqual({ game, mode: 'edit', itemCounts: counts });
    });

    it('redirects to /games when navigation state is invalid', () => {
        history.pushState({}, '', '');
        mapSetup.initializeGridIfEmpty.and.callFake(() => {
            throw new Error('no game');
        });

        expect(() => service.initializeFromNavigation()).toThrow();
        expect(router.navigate).toHaveBeenCalledWith(['/games']);
    });

    it('goes to /admin', () => {
        service.navigateToAdmin();
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    it('creates a new game (thumbnail + validation + API call)', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('new-thumb');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.createGame.and.returnValue(of(undefined));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'create');

        expect(game.thumbnail).toBe('new-thumb');
        expect(communication.createGame).toHaveBeenCalledWith(game);
        expect(alertSpy).toHaveBeenCalledWith('Game created successfully!');
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    it('updates an existing game (new thumbnail capture)', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        const captureSpy = spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('ignored');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.getAllGames.and.returnValue(of([game]));
        communication.modifyGame.and.returnValue(of(undefined));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(captureSpy).toHaveBeenCalled();
        expect(communication.getAllGames).toHaveBeenCalled();
        expect(communication.modifyGame).toHaveBeenCalledWith(game);
        expect(alertSpy).toHaveBeenCalledWith('Game saved successfully!');
    });

    it('shows a clear error when thumbnail generation fails', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.rejectWith(new Error('fail'));
        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'create');

        expect(alertSpy).toHaveBeenCalledWith('Save failed: unable to generate map thumbnail.');
        expect(validator.validate).not.toHaveBeenCalled();
    });

    it('shows validation errors and does not call the API', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: false, errors: ['bad'] });

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(alertSpy).toHaveBeenCalledWith('Save failed: unable to generate map thumbnail.');
        expect(communication.modifyGame).not.toHaveBeenCalled();
    });

    it('reports API errors on save', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.getAllGames.and.returnValue(of([game]));
        communication.modifyGame.and.returnValue(throwError(() => ({ error: 'bad' })));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(alertSpy).toHaveBeenCalledWith('Save failed: unable to generate map thumbnail.');
    });

    it('captures a thumbnail when the DOM element exists', async () => {
        const el = document.createElement('div');
        el.id = 'tubmnail';
        el.style.width = `${THUMBNAIL_SIZE_PX}px`;
        el.style.height = `${THUMBNAIL_SIZE_PX}px`;
        document.body.appendChild(el);

        const dataUrl = await (service as unknown as CaptureThumbnailApi).captureThumbnail(CAPTURE_TEST_SEED);

        expect(typeof dataUrl).toBe('string');
        expect(dataUrl.startsWith('data:')).toBeTrue();

        el.remove();
    });

    it('throws if the thumbnail element is missing', async () => {
        const existing = document.getElementById('tubmnail');
        existing?.remove();

        await expectAsync(
            (service as unknown as CaptureThumbnailApi).captureThumbnail(CAPTURE_TEST_SEED),
        ).toBeRejectedWithError('Thumbnail element not found');
    });
});
