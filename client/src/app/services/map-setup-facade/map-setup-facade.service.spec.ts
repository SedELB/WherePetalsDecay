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

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import swal from 'sweetalert2';

import { CommunicationService } from '@app/services/communication/communication.service';
import { GameValidatorService } from '@app/services/game-validator/game-validator.service';
import { MapSetupFacadeService } from '@app/services/map-setup-facade/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';

import { GameMode, TileTexture } from '@common/enums';
import type { Game } from '@common/game';
import type { Tile } from '@common/tile';

const grid = (rows: number, cols: number): Tile[][] =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            type: TileTexture.Floor,
            item: null,
        })),
    );

const SIZE_SMALL = 10;
const THUMBNAIL_SIZE_PX = 10;

type CaptureThumbnailApi = {
    captureThumbnail: (element: HTMLElement) => Promise<string>;
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
    const mockElement = {} as HTMLElement;
    let router: jasmine.SpyObj<Router>;
    let route: ActivatedRoute;
    let communication: jasmine.SpyObj<CommunicationService>;
    let validator: jasmine.SpyObj<GameValidatorService>;
    let mapSetup: jasmine.SpyObj<MapSetupService>;
    let tileItemCount: jasmine.SpyObj<TileItemCountService>;
    let service: MapSetupFacadeService;

    beforeEach(async () => {
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        route = { snapshot: { paramMap: { get: () => null } } } as unknown as ActivatedRoute;
        communication = jasmine.createSpyObj<CommunicationService>('CommunicationService', [
            'createGame',
            'modifyGame',
            'getAllGames',
            'getGameById',
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

        await TestBed.configureTestingModule({
            providers: [
                MapSetupFacadeService,
                provideRouter([]),
                { provide: Router, useValue: router },
                { provide: CommunicationService, useValue: communication },
                { provide: GameValidatorService, useValue: validator },
                { provide: MapSetupService, useValue: mapSetup },
                { provide: TileItemCountService, useValue: tileItemCount },
                { provide: ActivatedRoute, useValue: route },
            ],
        }).compileComponents();

        service = TestBed.inject(MapSetupFacadeService);
    });

    // Test navigation state initialization with valid game
    it('reads the game from navigation state and prepares item counts', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const counts = { spawnCount: 2, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 0 };

        history.pushState({ game, mode: 'edit' }, '', '');
        tileItemCount.createRequiredCounts.and.returnValue(counts);

        const result = await service.initializeFromNavigation();

        expect(mapSetup.initializeGridIfEmpty).toHaveBeenCalledWith(game);
        expect(tileItemCount.adjustCountsForExistingItems).toHaveBeenCalledWith(game, counts);
        expect(result).toEqual({ game, mode: 'edit', itemCounts: counts });
    });

    // Test navigation with missing game state
    it('redirects to /admin when navigation state is invalid', async () => {
        history.pushState({}, '', '');

        const result = await service.initializeFromNavigation();
        expect(result).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
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

        const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

        await service.saveGame(game, 'create', mockElement);

        expect(game.thumbnail).toBe('new-thumb');
        expect(communication.createGame).toHaveBeenCalledWith(game);
        expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Succès' }));
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

        const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

        await service.saveGame(game, 'edit', mockElement);

        expect(game.thumbnail).toBe('edit-thumb');
        expect(communication.modifyGame).toHaveBeenCalledWith(game);
        expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Succès' }));
        expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });

    // Test thumbnail generation error handling
    it('shows a clear error when thumbnail generation fails', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);

        spyOn(service as unknown as CaptureThumbnailApi, 'captureThumbnail').and.rejectWith(new Error('fail'));
        const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

        await service.saveGame(game, 'create', mockElement);

        expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: `Problème d'enregistrement` }));
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

        const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

        await service.saveGame(game, 'edit', mockElement);

        expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Jeu invalide !' }));
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

        const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

        await service.saveGame(game, 'edit', mockElement);

        expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Jeu invalide !' }));
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

        const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

        await service.saveGame(game, 'edit', mockElement);

        expect(communication.createGame).toHaveBeenCalledWith(game);
        expect(communication.modifyGame).not.toHaveBeenCalled();
        expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Succès' }));
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

    const swalSpy = spyOn(swal, 'fire').and.resolveTo({ isConfirmed: true } as never);

    await service.saveGame(game, 'create', mockElement);

    expect(swalSpy).toHaveBeenCalledWith(jasmine.objectContaining({ 
        title: 'Erreur',
        text: "Une erreur s'est produite en enregistrant un nouveau jeu : creation failed"
    }));
});

    // Test default mode behavior
    it('defaults mode to edit when not specified in navigation state', async () => {
        const game = gameFactory(SIZE_SMALL, SIZE_SMALL, GameMode.Classic);
        const counts = { spawnCount: 2, healingSanctuaryCount: 1, combatSanctuaryCount: 1, flagCount: 0 };

        history.pushState({ game }, '', '');
        tileItemCount.createRequiredCounts.and.returnValue(counts);

        const result = await service.initializeFromNavigation();

        expect(result?.mode).toBe('edit');
    });

    // Test successful thumbnail capture
    it('captures a thumbnail when the DOM element exists', async () => {
        const element = document.createElement('div');
        element.style.width = `${THUMBNAIL_SIZE_PX}px`;
        element.style.height = `${THUMBNAIL_SIZE_PX}px`;
        document.body.appendChild(element);

        const dataUrl = await (service as unknown as CaptureThumbnailApi).captureThumbnail(element);

        expect(typeof dataUrl).toBe('string');
        expect(dataUrl.startsWith('data:')).toBeTrue();

        element.remove();
    });

    // Test thumbnail capture with invalid element
    it('throws if the thumbnail element cannot be captured', async () => {
        const element = {} as HTMLElement;

        await expectAsync(
            (service as unknown as CaptureThumbnailApi).captureThumbnail(element),
        ).toBeRejected();
    });
});
