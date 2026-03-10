/**
 * Testing:
 * - Component lifecycle (ngOnInit, ngOnDestroy)
 * - Game list updates via service/socket
 */

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameCreationService } from '@app/services/game-creation/game-creation.service';
import { GameMode } from '@common/enums';
import { Game } from '@common/game';
import { BehaviorSubject, of } from 'rxjs';
import { GameCreationComponent } from './game-creation.component';

describe('GameCreationComponent', () => {
    let component: GameCreationComponent;
    let fixture: ComponentFixture<GameCreationComponent>;
    let gameCreationService: jasmine.SpyObj<GameCreationService>;
    let visibleGamesSubject: BehaviorSubject<Game[]>;

    const MOCK_GAMES: Game[] = [
        {
            _id: '1',
            name: 'Test1',
            description: 'test1description',
            size: { rows: 20, cols: 20 },
            gameMode: GameMode.Classic,
            thumbnail: 'thumb',
            maxPlayers: 6,
            grid: [],
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-01-15'),
            isVisible: true,
        },
        {
            _id: '2',
            name: 'Test2',
            description: 'test2description',
            size: { rows: 10, cols: 10 },
            gameMode: GameMode.Ctf,
            thumbnail: 'thumb',
            maxPlayers: 2,
            grid: [],
            createdAt: new Date('2024-02-10'),
            updatedAt: new Date('2024-02-10'),
            isVisible: true,
        },
        {
            _id: '3',
            name: 'Test3',
            description: 'test3description',
            size: { rows: 15, cols: 15 },
            gameMode: GameMode.Classic,
            thumbnail: 'thumb',
            maxPlayers: 4,
            grid: [],
            createdAt: new Date('2024-03-01'),
            updatedAt: new Date('2024-03-01'),
            isVisible: false,
        },
    ];

    beforeEach(async () => {
        // Mock BehaviorSubject for visible games stream
        visibleGamesSubject = new BehaviorSubject<Game[]>(MOCK_GAMES);

        // Mock GameCreationService
        gameCreationService = jasmine.createSpyObj(
            'GameCreationService',
            ['fetchVisibleGames', 'setGames'],
            { visibleGames$: visibleGamesSubject.asObservable() },
        );

        // Make fetchVisibleGames return our mock data
        gameCreationService.fetchVisibleGames.and.returnValue(of(MOCK_GAMES));

        // Configure the testing module
        await TestBed.configureTestingModule({
            imports: [GameCreationComponent, HttpClientTestingModule],
            providers: [
                provideRouter([]),
                { provide: GameCreationService, useValue: gameCreationService },
            ],
        }).compileComponents();

        // Create component instance
        fixture = TestBed.createComponent(GameCreationComponent);
        component = fixture.componentInstance;
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    // Fetch visible games on component construction
    it('should call fetchVisibleGames on ngOnInit', () => {
        fixture.detectChanges();
        expect(gameCreationService.fetchVisibleGames).toHaveBeenCalled();
    });

    // Successful call of fetchVisibleGames
    it('should call setGames with fetched games on successful fetch', () => {
        fixture.detectChanges();
        expect(gameCreationService.setGames).toHaveBeenCalledWith(MOCK_GAMES);
    });

    // Testing the subscription to visibleGames$, websocket
    it('should subscribe to visibleGames$ and fill games array', () => {
        fixture.detectChanges();
        expect(component.games.length).toBe(MOCK_GAMES.length);
    });

    // Make sure the ordering that appears is right
    it('should sort games by createdAt in ascending order', () => {
        fixture.detectChanges();
        expect(component.games[0].name).toBe('Test1');
        expect(component.games[1].name).toBe('Test2');
        expect(component.games[2].name).toBe('Test3');
    });

    // Handling possible backend type missmatch
    it('should handle createdAt as string when sorting', () => {
        const gamesWithStringDates: Game[] = [
            { ...MOCK_GAMES[0], createdAt: '2024-01-01' as unknown as Date },
            { ...MOCK_GAMES[1], createdAt: '2024-03-01' as unknown as Date },
        ];

        visibleGamesSubject.next(gamesWithStringDates);
        fixture.detectChanges();

        expect(component.games[0].name).toBe('Test1');
        expect(component.games[1].name).toBe('Test2');
    });

    // Stop the tracking visibleGames$ when the component is destroyed
    it('should unsubscribe from visibleGames$ on ngOnDestroy', () => {
        fixture.detectChanges();

        const subscription = component['gamesSubscription'];
        if (subscription) {
            spyOn(subscription, 'unsubscribe');
        }

        component.ngOnDestroy();

        if (subscription) {
            expect(subscription.unsubscribe).toHaveBeenCalled();
        }
    });

    // Testing for possible undefined games$ subscription
    it('should not throw error in ngOnDestroy if subscription is undefined', () => {
        component['gamesSubscription'] = null;
        expect(() => component.ngOnDestroy()).not.toThrow();
    });

});

