import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { AdminGameService } from '@app/services/admin-game/admin-game.service';
import { MapSetupFacadeService } from '@app/services/map-setup-facade/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { of } from 'rxjs';
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
    maxPlayers: 4,
    grid: makeGrid(SIZE_SMALL, SIZE_SMALL),
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
    let tileItemCountService: jasmine.SpyObj<TileItemCountService>;
    let adminGameService: jasmine.SpyObj<AdminGameService>;
    let game: Game;

    beforeEach(async () => {
        game = makeGame();
        facade = jasmine.createSpyObj('MapSetupFacadeService', ['initializeFromNavigation', 'navigateToAdmin', 'saveGame']);
        service = jasmine.createSpyObj('MapSetupService', [
            'getObjectAt',
            'selectTileTexture',
            'selectTileItem',
            'applyActiveSelection',
            'handleCellMouseDown',
            'handleCellMouseEnter',
            'resetInteractionState',
            'resetMap',
        ]);
        tileItemCountService = jasmine.createSpyObj('TileItemCountService', [
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
        ]);

        const counts = makeCounts();
        facade.initializeFromNavigation.and.returnValue({ game, mode: 'edit', itemCounts: counts });

        const mapSetupDefaults: Record<string, unknown> = {
            getObjectAt: game.grid[0][0],
            selectTileTexture: { activeTileTexture: TileTexture.Wall, activeTileItem: null },
            selectTileItem: { activeTileTexture: null, activeTileItem: TileItem.Spawn },
            handleCellMouseDown: { isPaintingTiles: true, isErasingTiles: false },
            handleCellMouseEnter: { isPaintingTiles: false, isErasingTiles: true },
            resetInteractionState: { isPaintingTiles: false, isErasingTiles: false },
            resetMap: { itemCounts: counts, selection: { activeTileTexture: null, activeTileItem: null } },
        };

        const countDefaults: Record<string, unknown> = {
            getRequiredSpawnCount: 2,
            getRequiredFlagCount: 0,
            getRequiredHealingSanctuaryCount: 1,
            getRequiredCombatSanctuaryCount: 1,
            countTileTexture: WALL_COUNT,
            countTileItem: 1,
            getPlacedSpawnCount: 1,
            getPlacedFlagCount: 0,
            getPlacedHealingSanctuaryCount: 1,
            getPlacedCombatSanctuaryCount: 1,
            isObjectTypeComplete: true,
        };

        Object.entries(mapSetupDefaults).forEach(([method, value]) => {
            (service[method as keyof typeof service] as jasmine.Spy).and.returnValue(value);
        });
        Object.entries(countDefaults).forEach(([method, value]) => {
            (tileItemCountService[method as keyof typeof tileItemCountService] as jasmine.Spy).and.returnValue(
                value,
            );
        });

        adminGameService = jasmine.createSpyObj('AdminGameService', ['fetchAllGames', 'setGames'], {
            games$: of([game]),
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
        expect(component.getPlacedSpawnCount()).toBe(1);
        expect(component.getPlacedFlagCount()).toBe(0);
        expect(component.isObjectTypeComplete(TileItem.Spawn)).toBeTrue();
    });

    it('delegates queries and selection', () => {
        expect(component.countTileTexture(TileTexture.Wall)).toBe(WALL_COUNT);
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
        component.onCellMouseDown(1, 1, {} as MouseEvent);
        expect(service.handleCellMouseDown).toHaveBeenCalled();
        expect((component as unknown as { isPaintingTiles: boolean }).isPaintingTiles).toBeTrue();

        component.onCellMouseEnter(1, 1, {} as MouseEvent);
        expect(service.handleCellMouseEnter).toHaveBeenCalled();
        expect((component as unknown as { isErasingTiles: boolean }).isErasingTiles).toBeTrue();
    });
});
