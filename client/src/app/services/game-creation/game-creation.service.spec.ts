/**
 * Testing:
 * - HTTP API calls (fetchVisibleGames)
 * - WebSocket event listeners (GameCreated, GameDeleted, GameVisibilityChanged)
 * - State management (BehaviorSubject visibleGames$)
 * - Game list manipulation for visible games only
 */

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { environment } from 'src/environments/environment';
import { GameCreationService } from './game-creation.service';
import { GameCreationEvents } from '@common/socket-events/games.gateway.events';


describe('GameCreationService', () => {
    let service: GameCreationService;
    let httpMock: HttpTestingController;
    let webSocketService: jasmine.SpyObj<WebSocketService>;
    let gameCreatedCallback: (game: Game) => void;
    let gameDeletedCallback: (gameId: string) => void;
    let visibilityChangedCallback: (data: { gameId: string; isVisible: boolean }) => void;

    const MOCK_GAME: Game = {
        _id: '1',
        name: 'Visible Game',
        description: 'Test Description',
        size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic,
        thumbnail: 'thumb',
        maxPlayers: 2,
        grid: [],
        isVisible: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
    };

    const MOCK_GAME_2: Game = {
        _id: '2',
        name: 'Another Game',
        description: 'Test Description 2',
        size: { rows: 15, cols: 15 },
        gameMode: GameMode.Ctf,
        thumbnail: 'filler.png',
        maxPlayers: 4,
        grid: [],
        isVisible: true,
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-02-10'),
    };

    beforeEach(() => {
        webSocketService = jasmine.createSpyObj('WebSocketService', ['onNamespace']);

        // Capture callbacks when onNamespace is called
        webSocketService.onNamespace.and.callFake(<T>(_namespace: string, event: string, callback: (data: T) => void) => {
            if (event === GameCreationEvents.GameCreated) {
                gameCreatedCallback = callback as (game: Game) => void;
            } else if (event === GameCreationEvents.GameDeleted) {
                gameDeletedCallback = callback as (gameId: string) => void;
            } else if (event === GameCreationEvents.GameVisibilityChanged) {
                visibilityChangedCallback = callback as (data: { gameId: string; isVisible: boolean }) => void;
            }
        });

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                GameCreationService,
                { provide: WebSocketService, useValue: webSocketService },
            ],
        });

        service = TestBed.inject(GameCreationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test WebSocke setup
    it('should setup WebSocket listeners on construction', () => {
        const EXPECTED_LISTENER_COUNT = 3;
        expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Games,
            GameCreationEvents.GameCreated,
            jasmine.any(Function),
        );
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Games,
            GameCreationEvents.GameDeleted,
            jasmine.any(Function),
        );
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Games,
            GameCreationEvents.GameVisibilityChanged,
            jasmine.any(Function),
        );
    });

    // Test initial state
    it('should start with empty games array', (done) => {
        service.visibleGames$.subscribe((games) => {
            expect(games).toEqual([]);
            done();
        });
    });

    // Test setGames
    it('should set games and emit via visibleGames$', (done) => {
        const games = [MOCK_GAME, MOCK_GAME_2];
        service.setGames(games);

        service.visibleGames$.subscribe((emittedGames) => {
            expect(emittedGames).toEqual(games);
            done();
        });
    });

    // Test fetchVisibleGames HTTP call
    it('should fetch visible games via HTTP GET', () => {
        const mockGames = [MOCK_GAME, MOCK_GAME_2];

        service.fetchVisibleGames().subscribe((games) => {
            expect(games).toEqual(mockGames);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
        expect(req.request.method).toBe('GET');
        req.flush(mockGames);
    });

    // Empty response from API
    it('should handle empty array from fetchVisibleGames', () => {
        service.fetchVisibleGames().subscribe((games) => {
            expect(games).toEqual([]);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
        req.flush([]);
    });

    // Test GameCreated WebSocket event
    it('should add new game when GameCreated event is received', (done) => {
        service.setGames([MOCK_GAME]);

        gameCreatedCallback(MOCK_GAME_2);

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(2);
            expect(games).toContain(MOCK_GAME);
            expect(games).toContain(MOCK_GAME_2);
            done();
        });
    });

    // GameCreated on empty list
    it('should add game to empty list when GameCreated is received', (done) => {
        gameCreatedCallback(MOCK_GAME);

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0]).toEqual(MOCK_GAME);
            done();
        });
    });

    // Test GameDeleted WebSocket event
    it('should remove game when GameDeleted event is received', (done) => {
        service.setGames([MOCK_GAME, MOCK_GAME_2]);

        gameDeletedCallback('1');

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games.find(g => g._id === '1')).toBeUndefined();
            expect(games[0]._id).toBe('2');
            done();
        });
    });

    // GameDeleted for non-existent game
    it('should not modify list when deleting non-existent game', (done) => {
        service.setGames([MOCK_GAME]);

        gameDeletedCallback('999');

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0]._id).toBe('1');
            done();
        });
    });

    // GameDeleted on empty list
    it('should handle deletion on empty list', (done) => {
        gameDeletedCallback('1');

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(0);
            done();
        });
    });

    // Test GameVisibilityChanged the game becomes hidden
    it('should remove game when visibility changes to false', (done) => {
        service.setGames([MOCK_GAME, MOCK_GAME_2]);

        visibilityChangedCallback({ gameId: '1', isVisible: false });

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games.find(g => g._id === '1')).toBeUndefined();
            done();
        });
    });

    // Test GameVisibilityChanged the game becomes visible so API CALL
    it('should fetch games when visibility changes to true', (done) => {
        service.setGames([MOCK_GAME]);

        visibilityChangedCallback({ gameId: '2', isVisible: true });

        // Should trigger HTTP request
        const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
        expect(req.request.method).toBe('GET');
        req.flush([MOCK_GAME, MOCK_GAME_2]);

        done();
    });

    // Visibility change to false for non-existent game
    it('should not modify list when hiding non-existent game', (done) => {
        service.setGames([MOCK_GAME]);

        visibilityChangedCallback({ gameId: '999', isVisible: false });

        service.visibleGames$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0]._id).toBe('1');
            done();
        });
    });

    // Test that visibleGames$ is observable
    it('should emit to multiple subscribers', () => {
        const subscriber1Results: Game[][] = [];
        const subscriber2Results: Game[][] = [];

        service.visibleGames$.subscribe(games => subscriber1Results.push(games));
        service.visibleGames$.subscribe(games => subscriber2Results.push(games));

        service.setGames([MOCK_GAME]);

        expect(subscriber1Results.length).toBeGreaterThan(0);
        expect(subscriber2Results.length).toBeGreaterThan(0);
        expect(subscriber1Results[subscriber1Results.length - 1]).toEqual([MOCK_GAME]);
        expect(subscriber2Results[subscriber2Results.length - 1]).toEqual([MOCK_GAME]);
    });
});
