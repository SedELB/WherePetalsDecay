import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { MapSetupFacadeService } from '@app/services/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { MapSetupPageComponent } from './map-setup-page.component';

const makeGrid = (rows: number, cols: number): Tile[][] =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, (): Tile => ({ type: TileTexture.Floor, item: null }))
    );

const makeGame = (): Game => ({
    _id: 'game-id',
    name: 'test',
    description: 'desc',
    size: { rows: 10, cols: 10 },
    gameMode: GameMode.Classic,
    thumbnail: 'thumb',
    maxPlayers: 4,
    grid: makeGrid(10, 10),
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
});

const makeCounts = () => ({
    spawnCount: 2,
    healingSanctuaryCount: 1,
    combatSanctuaryCount: 1,
    flagCount: 0,
});

describe('MapSetupPageComponent', () => {
    let component: MapSetupPageComponent;
    let fixture: ComponentFixture<MapSetupPageComponent>;
    let facade: jasmine.SpyObj<MapSetupFacadeService>;
    let service: jasmine.SpyObj<MapSetupService>;
    let game: Game;

    beforeEach(async () => {
        game = makeGame();
        facade = jasmine.createSpyObj('MapSetupFacadeService', ['initializeFromNavigation', 'navigateToAdmin', 'saveGame']);
        service = jasmine.createSpyObj('MapSetupService', [
            'getRequiredSpawnCount',
            'getRequiredFlagCount',
            'getRequiredHealingSanctuaryCount',
            'getRequiredCombatSanctuaryCount',
            'countTileTexture',
            'countTileItem',
            'getPlacedSpawnCount',
            'getPlacedFlagCount',
            'getPlacedHealingSanctuaryCount',
            'getPlacedCombatSanctuaryCount',
            'isObjectTypeComplete',
            'getObjectAt',
            'selectTileTexture',
            'selectTileItem',
            'applyActiveSelection',
            'handleCellMouseDown',
            'handleCellMouseEnter',
            'resetInteractionState',
            'resetMap',
        ]);

        const counts = makeCounts();
        facade.initializeFromNavigation.and.returnValue({ game, mode: 'edit', itemCounts: counts });

        const defaults: Record<string, unknown> = {
            getRequiredSpawnCount: 2,
            getRequiredFlagCount: 0,
            getRequiredHealingSanctuaryCount: 1,
            getRequiredCombatSanctuaryCount: 1,
            countTileTexture: 3,
            countTileItem: 1,
            getPlacedSpawnCount: 1,
            getPlacedFlagCount: 0,
            getPlacedHealingSanctuaryCount: 1,
            getPlacedCombatSanctuaryCount: 1,
            isObjectTypeComplete: true,
            getObjectAt: game.grid[0][0],
            selectTileTexture: { activeTileTexture: TileTexture.Wall, activeTileItem: null },
            selectTileItem: { activeTileTexture: null, activeTileItem: TileItem.Spawn },
            handleCellMouseDown: { isPaintingTiles: true, isErasingTiles: false },
            handleCellMouseEnter: { isPaintingTiles: false, isErasingTiles: true },
            resetInteractionState: { isPaintingTiles: false, isErasingTiles: false },
            resetMap: { itemCounts: counts, selection: { activeTileTexture: null, activeTileItem: null } },
        };

        Object.entries(defaults).forEach(([method, value]) => {
            (service as any)[method].and.returnValue(value);
        });

        await TestBed.configureTestingModule({
            imports: [MapSetupPageComponent],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { snapshot: { params: {}, queryParams: {}, data: {} } } },
                { provide: MapSetupFacadeService, useValue: facade },
                { provide: MapSetupService, useValue: service },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MapSetupPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('initializes from the facade', () => {
        expect(facade.initializeFromNavigation).toHaveBeenCalled();
        expect(component.game).toBe(game);
        expect(component.mode).toBe('edit');
    });

    it('delegates counts and completion', () => {
        expect(component.getRequiredSpawnCount()).toBe(2);
        expect(component.getRequiredFlagCount()).toBe(0);
        expect(component.getRequiredHealingSanctuaryCount()).toBe(1);
        expect(component.getRequiredCombatSanctuaryCount()).toBe(1);

        expect(component.getPlacedSpawnCount()).toBe(1);
        expect(component.getPlacedFlagCount()).toBe(0);
        expect(component.getPlacedHealingSanctuaryCount()).toBe(1);
        expect(component.getPlacedCombatSanctuaryCount()).toBe(1);
        expect(component.isObjectTypeComplete(TileItem.Spawn)).toBeTrue();
    });

    it('delegates queries and selection', () => {
        expect(component.countTileTexture(TileTexture.Wall)).toBe(3);
        expect(component.countTileItem(TileItem.Spawn)).toBe(1);
        expect(component.getObjectAt(0, 0)).toBe(game.grid[0][0]);

        component.selectTileTexture(TileTexture.Wall);
        expect(component.activeTileTexture).toBe(TileTexture.Wall);
        expect(component.activeTileItem).toBeNull();

        component.selectTileItem(TileItem.Spawn);
        expect(component.activeTileItem).toBe(TileItem.Spawn);
        expect(component.activeTileTexture).toBeNull();
    });

    it('handles grid interactions', () => {
        component.onCellClick(1, 1);
        expect(service.applyActiveSelection).toHaveBeenCalled();

        component.onCellMouseDown(1, 1, {} as MouseEvent);
        expect(service.handleCellMouseDown).toHaveBeenCalled();
        expect((component as any).isPaintingTiles).toBeTrue();

        component.onCellMouseEnter(1, 1, {} as MouseEvent);
        expect(service.handleCellMouseEnter).toHaveBeenCalled();
        expect((component as any).isErasingTiles).toBeTrue();
    });

    it('resets flags, navigates and saves', async () => {
        component.onGridMouseLeave();
        expect((component as any).isPaintingTiles).toBeFalse();
        expect((component as any).isErasingTiles).toBeFalse();

        component.onDocumentMouseUp();
        expect((component as any).isPaintingTiles).toBeFalse();
        expect((component as any).isErasingTiles).toBeFalse();

        component.onBack();
        expect(facade.navigateToAdmin).toHaveBeenCalled();

        await component.onSave();
        expect(facade.saveGame).toHaveBeenCalledWith(game, 'edit');

        component.onReset();
        expect(service.resetMap).toHaveBeenCalledWith(game);
        expect(component.activeTileTexture).toBeNull();
        expect(component.activeTileItem).toBeNull();
    });
});
