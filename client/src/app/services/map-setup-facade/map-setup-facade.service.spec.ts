/**
 * Testing:
 * - Navigation state initialization and game preparation
 * - Item count creation and adjustment
 * - Game creation and modification workflows
 * - Thumbnail capture and image generation
 * - Validation integration and error handling
 * - API communication and error scenarios
 * - Mode switching (create/edit) logic
 */

import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CommunicationService } from '@app/services/communication/communication.service';
import { GameValidatorService } from '@app/services/game-validator/game-validator.service';
import { MapSetupFacadeService } from '@app/services/map-setup-facade/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';

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
    maxPlayers: 6,
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

    // Test navigation state initialization with valid game
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

    // Test navigation with missing game state
    it('redirects to /games when navigation state is invalid', () => {
        history.pushState({}, '', '');
        mapSetup.initializeGridIfEmpty.and.callFake(() => {
            throw new Error('no game');
        });

        expect(() => service.initializeFromNavigation()).toThrow();
        expect(router.navigate).toHaveBeenCalledWith(['/games']);
    });

    // Test navigation to admin page
    it('goes to /admin', () => {
        service.navigateToAdmin();
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    // Test complete game creation workflow
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
        expect(alertSpy).toHaveBeenCalledWith('Partie créée avec succès !');
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    // Test game modification workflow
    it('updates an existing game (edit mode with existing game)', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('edit-thumb');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.getAllGames.and.returnValue(of([game]));
        communication.modifyGame.and.returnValue(of(undefined));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(game.thumbnail).toBe('edit-thumb');
        expect(communication.modifyGame).toHaveBeenCalledWith(game);
        expect(alertSpy).toHaveBeenCalledWith('Jeu sauvegardé avec succès !');
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    // Test thumbnail generation error handling
    it('shows a clear error when thumbnail generation fails', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.rejectWith(new Error('fail'));
        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'create');

        expect(alertSpy).toHaveBeenCalledWith('Problème d\'enregistrement : la génération de l\'image a échouée ');
        expect(validator.validate).not.toHaveBeenCalled();
    });

    // Test validation failure prevents API call
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

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('thumb');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: false, errors: ['Erreur 1', 'Erreur 2'] });

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(alertSpy).toHaveBeenCalledWith('Jeu invalide! :\n- Erreur 1\n- Erreur 2');
        expect(communication.modifyGame).not.toHaveBeenCalled();
        expect(communication.createGame).not.toHaveBeenCalled();
    });

    // Test API error handling in edit mode
    it('reports API errors on save in edit mode', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('thumb');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.getAllGames.and.returnValue(of([game]));
        communication.modifyGame.and.returnValue(throwError(() => ({ error: 'bad' })));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(alertSpy).toHaveBeenCalledWith('Une erreur s\'est produite en enregistrant un jeu édité !');
    });

    // Test fallback to create mode when game doesn't exist
    it('switches from edit to create mode when game not found', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('thumb');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.getAllGames.and.returnValue(of([]));
        communication.createGame.and.returnValue(of(undefined));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'edit');

        expect(communication.createGame).toHaveBeenCalledWith(game);
        expect(communication.modifyGame).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith('Jeu créé avec succès !');
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    // Test API error handling in create mode
    it('reports API errors on save in create mode', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const validationPayload = {
            name: game.name,
            description: game.description,
            mode: game.gameMode,
            size: game.size,
            grid: [[TileTexture.Floor]],
            placedObjects: [],
        };

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.resolveTo('thumb');
        mapSetup.buildValidationPayload.and.returnValue(validationPayload);
        validator.validate.and.returnValue({ isValid: true, errors: [] });
        communication.createGame.and.returnValue(throwError(() => ({ error: 'creation failed' })));

        const alertSpy = spyOn(window, 'alert');

        await service.saveGame(game, 'create');

        expect(alertSpy).toHaveBeenCalledWith('Une erreur s\'est produite en enregistrant un nouveau jeu');
    });

    // Test default mode behavior
    it('defaults mode to edit when not specified in navigation state', () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const counts = { spawnCount: 2, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 0 };

        history.pushState({ game }, '', '');
        tileItemCount.createRequiredCounts.and.returnValue(counts);

        const result = service.initializeFromNavigation();

        expect(result.mode).toBe('edit');
    });

    // Test successful thumbnail capture
    it('captures a thumbnail when the DOM element exists', async () => {
        const el = document.createElement('div');
        el.id = 'thumbnail';
        el.style.width = `${THUMBNAIL_SIZE_PX}px`;
        el.style.height = `${THUMBNAIL_SIZE_PX}px`;
        document.body.appendChild(el);

        const dataUrl = await (service as unknown as CaptureThumbnailApi).captureThumbnail(CAPTURE_TEST_SEED);

        expect(typeof dataUrl).toBe('string');
        expect(dataUrl.startsWith('data:')).toBeTrue();

        el.remove();
    });

    // Test thumbnail capture with missing element
    it('throws if the thumbnail element is missing', async () => {
        const existing = document.getElementById('thumbnail');
        existing?.remove();

        await expectAsync(
            (service as unknown as CaptureThumbnailApi).captureThumbnail(CAPTURE_TEST_SEED),
        ).toBeRejectedWithError('image de prévisualisation est introuvable');
    });
});
