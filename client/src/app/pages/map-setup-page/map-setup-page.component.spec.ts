/**
 * Testing:
 * - Component lifecycle (ngOnInit, ngOnDestroy)
 * - Game initialization from navigation (create/edit modes)
 * - Real-time game sync (game deletion, concurrent edits)
 * - Tile texture and item selection
 * - Grid interaction (mouse events, painting, erasing)
 * - Game save and reset functionality
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AdminGameService } from '@app/services/admin-game/admin-game.service';
import { MapSetupFacadeService } from '@app/services/map-setup-facade/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Game } from '@common/game';
import { Tile } from '@common/tile';
import { BehaviorSubject } from 'rxjs';
import { MapSetupPageComponent } from './map-setup-page.component';

const makeGrid = (rows: number, cols: number): Tile[][] =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, (): Tile => ({ type: TileTexture.Floor, item: null })),
    );

const SIZE_SMALL = 10;
const WALL_COUNT = 3;

const makeGame = (): Game => ({
    _id: 'game-id',
    name: 'test',
    description: 'desc',
    size: { rows: SIZE_SMALL, cols: SIZE_SMALL },
    gameMode: GameMode.Classic,
    thumbnail: 'thumb',
    maxPlayers: 2,
    grid: makeGrid(SIZE_SMALL, SIZE_SMALL),
    isVisible: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
});

const makeCounts = () => ({
    spawnCount: 2,
    flagCount: 0,
});

describe('MapSetupPageComponent', () => {
    let component: MapSetupPageComponent;
    let fixture: ComponentFixture<MapSetupPageComponent>;
    let facade: jasmine.SpyObj<MapSetupFacadeService>;
    let service: jasmine.SpyObj<MapSetupService>;
    let tileItemCountService: jasmine.SpyObj<TileItemCountService>;
    let adminGameService: jasmine.SpyObj<AdminGameService>;
    let gamesSubject: BehaviorSubject<Game[]>;
    let game: Game;

    // Setup
    beforeEach(async () => {
        game = makeGame();
        gamesSubject = new BehaviorSubject<Game[]>([game]);

        facade = jasmine.createSpyObj('MapSetupFacadeService', ['initializeFromNavigation', 'navigateToAdmin', 'saveGame']);
        service = jasmine.createSpyObj('MapSetupService', [
            'getObjectAt',
            'selectTileTexture',
            'selectTileItem',
            'handleCellMouseDown',
            'handleCellMouseEnter',
            'resetInteractionState',
        ]);
        tileItemCountService = jasmine.createSpyObj('TileItemCountService', [
            'getRequiredSpawnCount',
            'getRequiredFlagCount',
            'countTileTexture',
            'countTileItem',
            'getPlacedSpawnCount',
            'getPlacedFlagCount',
            'isObjectTypeComplete',
            'createRequiredCounts',
            'adjustCountsForExistingItems',
        ]);

        const counts = makeCounts();
        facade.initializeFromNavigation.and.returnValue({ game, mode: 'edit', itemCounts: counts });

        service.getObjectAt.and.returnValue(game.grid[0][0]);
        service.selectTileTexture.and.returnValue({ activeTileTexture: TileTexture.Wall, activeTileItem: null });
        service.selectTileItem.and.returnValue({ activeTileTexture: null, activeTileItem: TileItem.Spawn });
        service.handleCellMouseDown.and.returnValue({ isPaintingTiles: true, isErasingTiles: false });
        service.handleCellMouseEnter.and.returnValue({ isPaintingTiles: false, isErasingTiles: true });
        service.resetInteractionState.and.returnValue({ isPaintingTiles: false, isErasingTiles: false });

        tileItemCountService.getRequiredSpawnCount.and.returnValue(2);
        tileItemCountService.getRequiredFlagCount.and.returnValue(0);
        tileItemCountService.countTileTexture.and.returnValue(WALL_COUNT);
        tileItemCountService.countTileItem.and.returnValue(1);
        tileItemCountService.getPlacedSpawnCount.and.returnValue(1);
        tileItemCountService.getPlacedFlagCount.and.returnValue(0);
        tileItemCountService.isObjectTypeComplete.and.returnValue(true);
        tileItemCountService.createRequiredCounts.and.returnValue(counts);

        adminGameService = jasmine.createSpyObj('AdminGameService', [], {
            games$: gamesSubject.asObservable(),
        });

        await TestBed.configureTestingModule({
            imports: [MapSetupPageComponent],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { snapshot: { params: {}, queryParams: {}, data: {} } } },
                { provide: MapSetupFacadeService, useValue: facade },
                { provide: MapSetupService, useValue: service },
                { provide: TileItemCountService, useValue: tileItemCountService },
                { provide: AdminGameService, useValue: adminGameService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MapSetupPageComponent);
        component = fixture.componentInstance;
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    // Test initialization from facade
    it('should initialize from facade on ngOnInit', () => {
        fixture.detectChanges();
        expect(facade.initializeFromNavigation).toHaveBeenCalled();
        expect(component.game).toBe(game);
        expect(component.mode).toBe('edit');
    });

    // Test that initialGameState is saved
    it('should save initial game state on ngOnInit', () => {
        fixture.detectChanges();
        const initialState = (component as unknown as { initialGameState: Game }).initialGameState;
        expect(initialState).toBeTruthy();
        expect(initialState._id).toBe(game._id);
    });

    // Test subscription to games$ in edit mode
    it('should subscribe to games$ when in edit mode', () => {
        fixture.detectChanges();
        expect(component.mode).toBe('edit');
        const subscription = (component as unknown as { gameSubscription?: unknown }).gameSubscription;
        expect(subscription).toBeTruthy();
    });

    // Test no subscription in create mode
    it('should not subscribe to games$ when in create mode', () => {
        facade.initializeFromNavigation.and.returnValue({ game, mode: 'create', itemCounts: makeCounts() });
        fixture.detectChanges();
        const subscription = (component as unknown as { gameSubscription?: unknown }).gameSubscription;
        expect(subscription).toBeUndefined();
    });

    // Test game deletion scenario
    it('should switch to create mode when game is deleted by another admin', () => {
        fixture.detectChanges();
        spyOn(window, 'alert');

        gamesSubject.next([]);

        expect(component.mode).toBe('create');
        expect(window.alert).toHaveBeenCalledWith(
            'Ce jeu a été supprimé par un autre administrateur. ' +
            'Vous pouvez continuer à travailler et il sera créé comme un nouveau jeu lors de la sauvegarde.',
        );
    });

    // Test concurrent edit with user accepting update
    it('should update game when another admin modifies it and user accepts', () => {
        fixture.detectChanges();
        spyOn(window, 'confirm').and.returnValue(true);

        const updatedGame = { ...game, updatedAt: new Date('2024-02-15') };
        gamesSubject.next([updatedGame]);

        expect(window.confirm).toHaveBeenCalled();
        expect(tileItemCountService.createRequiredCounts).toHaveBeenCalled();
        expect(tileItemCountService.adjustCountsForExistingItems).toHaveBeenCalled();
    });

    // Test concurrent edit with user rejecting update
    it('should keep local changes when another admin modifies and user rejects', () => {
        fixture.detectChanges();
        spyOn(window, 'confirm').and.returnValue(false);

        const originalGameName = component.game.name;
        const updatedGame = { ...game, updatedAt: new Date('2024-02-15') };
        gamesSubject.next([updatedGame]);

        expect(window.confirm).toHaveBeenCalled();
        expect(component.game.name).toBe(originalGameName);
    });

    // Test save scenario updates isSaving flag
    it('should not prompt user when game is updated during save', () => {
        fixture.detectChanges();
        spyOn(window, 'confirm');
        (component as unknown as { isSaving: boolean }).isSaving = true;

        const updatedGame = { ...game, updatedAt: new Date('2024-02-15') };
        gamesSubject.next([updatedGame]);

        expect(window.confirm).not.toHaveBeenCalled();
        expect((component as unknown as { isSaving: boolean }).isSaving).toBe(false);
    });

    // Test ngOnDestroy cleanup
    it('should unsubscribe from games$ on ngOnDestroy', () => {
        fixture.detectChanges();
        const subscription = (component as unknown as { gameSubscription: { unsubscribe: () => void } }).gameSubscription;
        spyOn(subscription, 'unsubscribe');

        component.ngOnDestroy();

        expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    // Test ngOnDestroy with no subscription
    it('should not throw error in ngOnDestroy if subscription is undefined', () => {
        (component as unknown as { gameSubscription?: unknown }).gameSubscription = undefined;
        expect(() => component.ngOnDestroy()).not.toThrow();
    });

    // Test tile count delegation
    it('should delegate getRequiredSpawnCount to service', () => {
        fixture.detectChanges();
        expect(component.getRequiredSpawnCount()).toBe(2);
        expect(tileItemCountService.getRequiredSpawnCount).toHaveBeenCalledWith(game);
    });

    it('should delegate getRequiredFlagCount to service', () => {
        fixture.detectChanges();
        expect(component.getRequiredFlagCount()).toBe(0);
        expect(tileItemCountService.getRequiredFlagCount).toHaveBeenCalledWith(game);
    });

    it('should delegate countTileTexture to service', () => {
        fixture.detectChanges();
        expect(component.countTileTexture(TileTexture.Wall)).toBe(WALL_COUNT);
        expect(tileItemCountService.countTileTexture).toHaveBeenCalledWith(game, TileTexture.Wall);
    });

    it('should delegate countTileItem to service', () => {
        fixture.detectChanges();
        expect(component.countTileItem(TileItem.Spawn)).toBe(1);
        expect(tileItemCountService.countTileItem).toHaveBeenCalledWith(game, TileItem.Spawn);
    });

    it('should delegate getPlacedSpawnCount to service', () => {
        fixture.detectChanges();
        expect(component.getPlacedSpawnCount()).toBe(1);
        expect(tileItemCountService.getPlacedSpawnCount).toHaveBeenCalledWith(game);
    });

    it('should delegate getPlacedFlagCount to service', () => {
        fixture.detectChanges();
        expect(component.getPlacedFlagCount()).toBe(0);
        expect(tileItemCountService.getPlacedFlagCount).toHaveBeenCalledWith(game);
    });

    it('should delegate isObjectTypeComplete to service', () => {
        fixture.detectChanges();
        expect(component.isObjectTypeComplete(TileItem.Spawn)).toBe(true);
        expect(tileItemCountService.isObjectTypeComplete).toHaveBeenCalledWith(game, TileItem.Spawn);
    });

    // Test object queries
    it('should delegate getObjectAt to service', () => {
        fixture.detectChanges();
        const tile = component.getObjectAt(0, 0);
        expect(tile).toBe(game.grid[0][0]);
        expect(service.getObjectAt).toHaveBeenCalledWith(game, 0, 0);
    });

    // Test tile texture selection
    it('should select tile texture and update active states', () => {
        fixture.detectChanges();
        component.selectTileTexture(TileTexture.Wall);

        expect(service.selectTileTexture).toHaveBeenCalled();
        expect(component.activeTileTexture).toBe(TileTexture.Wall);
        expect(component.activeTileItem).toBeNull();
    });

    // Test tile item selection
    it('should select tile item and update active states', () => {
        fixture.detectChanges();
        component.selectTileItem(TileItem.Spawn);

        expect(service.selectTileItem).toHaveBeenCalled();
        expect(component.activeTileItem).toBe(TileItem.Spawn);
        expect(component.activeTileTexture).toBeNull();
    });

    // Test mouse down interaction
    it('should handle cell mouse down event', () => {
        fixture.detectChanges();
        const event = {} as MouseEvent;
        component.onCellMouseDown(1, 1, event);

        expect(service.handleCellMouseDown).toHaveBeenCalled();
        expect((component as unknown as { isPaintingTiles: boolean }).isPaintingTiles).toBe(true);
        expect((component as unknown as { isErasingTiles: boolean }).isErasingTiles).toBe(false);
    });

    // Test mouse enter interaction
    it('should handle cell mouse enter event', () => {
        fixture.detectChanges();
        const event = {} as MouseEvent;
        component.onCellMouseEnter(1, 1, event);

        expect(service.handleCellMouseEnter).toHaveBeenCalled();
        expect((component as unknown as { isPaintingTiles: boolean }).isPaintingTiles).toBe(false);
        expect((component as unknown as { isErasingTiles: boolean }).isErasingTiles).toBe(true);
    });

    // Test grid mouse leave
    it('should reset interaction state on grid mouse leave', () => {
        fixture.detectChanges();
        component.onGridMouseLeave();

        expect(service.resetInteractionState).toHaveBeenCalled();
        expect((component as unknown as { isPaintingTiles: boolean }).isPaintingTiles).toBe(false);
        expect((component as unknown as { isErasingTiles: boolean }).isErasingTiles).toBe(false);
    });

    // Test document mouse up
    it('should reset interaction state on document mouse up', () => {
        fixture.detectChanges();
        component.onDocumentMouseUp();

        expect(service.resetInteractionState).toHaveBeenCalled();
        expect((component as unknown as { isPaintingTiles: boolean }).isPaintingTiles).toBe(false);
        expect((component as unknown as { isErasingTiles: boolean }).isErasingTiles).toBe(false);
    });

    // Test navigation back
    it('should navigate to admin page on back', () => {
        fixture.detectChanges();
        component.onBack();

        expect(facade.navigateToAdmin).toHaveBeenCalled();
    });
});
