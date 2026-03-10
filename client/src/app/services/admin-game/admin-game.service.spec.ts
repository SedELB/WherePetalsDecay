/**
 * Testing:
 * - HTTP API calls (fetchAllGames)
 * - WebSocket event listeners (GameCreated, GameUpdated, GameDeleted, GameVisibilityChanged)
 * - State management (BehaviorSubject games$)
 * - Game list manipulation (add, update, delete, visibility)
 */

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Game } from '@common/game';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { environment } from 'src/environments/environment';
import { AdminGameService } from './admin-game.service';
import { AdminGameEvents } from '@common/socket-events/admin.gateway.events';

describe('AdminGameService', () => {
    let service: AdminGameService;
    let httpMock: HttpTestingController;
    let webSocketService: jasmine.SpyObj<WebSocketService>;
    let gameCreatedCallback: (game: Game) => void;
    let gameUpdatedCallback: (game: Game) => void;
    let gameDeletedCallback: (gameId: string) => void;
    let visibilityChangedCallback: (data: { gameId: string; isVisible: boolean }) => void;

    const MOCK_GAME: Game = {
        _id: '1',
        name: 'Test Game',
        description: 'Test Description',
        size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic,
        thumbnail: 'test.png',
        maxPlayers: 4,
        grid: [],
        isVisible: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
    };

    const MOCK_GAME_2: Game = {
        _id: '2',
        name: 'Test Game 2',
        description: 'Test Description 2',
        size: { rows: 15, cols: 15 },
        gameMode: GameMode.Ctf,
        thumbnail: 'filler.png',
        maxPlayers: 2,
        grid: [],
        isVisible: false,
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-02-10'),
    };

    beforeEach(() => {
        // Create spy for WebSocketService
        webSocketService = jasmine.createSpyObj('WebSocketService', ['onNamespace']);

        // Callbacks when onNamespace is called
        webSocketService.onNamespace.and.callFake(<T>(_namespace: string, event: string, callback: (data: T) => void) => {
            if (event === AdminGameEvents.GameCreated) {
                gameCreatedCallback = callback as (game: Game) => void;
            } else if (event === AdminGameEvents.GameUpdated) {
                gameUpdatedCallback = callback as (game: Game) => void;
            } else if (event === AdminGameEvents.GameDeleted) {
                gameDeletedCallback = callback as (gameId: string) => void;
            } else if (event === AdminGameEvents.GameVisibilityChanged) {
                visibilityChangedCallback = callback as (data: { gameId: string; isVisible: boolean }) => void;
            }
        });

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                AdminGameService,
                { provide: WebSocketService, useValue: webSocketService },
            ],
        });

        service = TestBed.inject(AdminGameService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test WebSocket listeners setup
    it('should setup WebSocket listeners on construction', () => {
        const EXPECTED_LISTENER_COUNT = 4;
        expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Admin,
            AdminGameEvents.GameCreated,
            jasmine.any(Function),
        );
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Admin,
            AdminGameEvents.GameUpdated,
            jasmine.any(Function),
        );
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Admin,
            AdminGameEvents.GameDeleted,
            jasmine.any(Function),
        );
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(
            SocketNamespace.Admin,
            AdminGameEvents.GameVisibilityChanged,
            jasmine.any(Function),
        );
    });

    // Test initial state
    it('should start with empty games array', (done) => {
        service.games$.subscribe((games) => {
            expect(games).toEqual([]);
            done();
        });
    });

    // Test setGames
    it('should set games and emit via games$', (done) => {
        const games = [MOCK_GAME, MOCK_GAME_2];
        service.setGames(games);

        service.games$.subscribe((emittedGames) => {
            expect(emittedGames).toEqual(games);
            done();
        });
    });

    // Test fetchAllGames http call
    it('should fetch all games via http get', () => {
        const mockGames = [MOCK_GAME, MOCK_GAME_2];

        service.fetchAllGames().subscribe((games) => {
            expect(games).toEqual(mockGames);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/allGames`);
        expect(req.request.method).toBe('GET');
        req.flush(mockGames);
    });

    // Empty response from API
    it('should handle empty array from fetchAllGames', () => {
        service.fetchAllGames().subscribe((games) => {
            expect(games).toEqual([]);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/allGames`);
        req.flush([]);
    });

    // Test GameCreated WebSocket event
    it('should add new game when GameCreated event is received', (done) => {
        service.setGames([MOCK_GAME]);

        // Trigger the GameCreated callback
        gameCreatedCallback(MOCK_GAME_2);

        service.games$.subscribe((games) => {
            expect(games.length).toBe(2);
            expect(games).toContain(MOCK_GAME);
            expect(games).toContain(MOCK_GAME_2);
            done();
        });
    });

    // GameCreated on empty list
    it('should add game to empty list when GameCreated is received', (done) => {
        gameCreatedCallback(MOCK_GAME);

        service.games$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0]).toEqual(MOCK_GAME);
            done();
        });
    });

    // Test GameUpdated WebSocket event
    it('should update existing game when GameUpdated event is received', (done) => {
        service.setGames([MOCK_GAME, MOCK_GAME_2]);

        const updatedGame = { ...MOCK_GAME, name: 'Updated Name' };
        gameUpdatedCallback(updatedGame);

        service.games$.subscribe((games) => {
            const game = games.find(g => g._id === '1');
            expect(game?.name).toBe('Updated Name');
            expect(games.length).toBe(2);
            done();
        });
    });

    // GameUpdated for non-existent game
    it('should not modify list when GameUpdated for non existent game', (done) => {
        service.setGames([MOCK_GAME]);

        const nonExistentGame = { ...MOCK_GAME_2, _id: '999' };
        gameUpdatedCallback(nonExistentGame);

        service.games$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0]._id).toBe('1');
            done();
        });
    });

    // Test GameDeleted WebSocket event
    it('should remove game when GameDeleted event is received', (done) => {
        service.setGames([MOCK_GAME, MOCK_GAME_2]);

        gameDeletedCallback('1');

        service.games$.subscribe((games) => {
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

        service.games$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0]._id).toBe('1');
            done();
        });
    });

    // GameDeleted on empty list
    it('should handle deletion on empty list', (done) => {
        gameDeletedCallback('1');

        service.games$.subscribe((games) => {
            expect(games.length).toBe(0);
            done();
        });
    });

    // Test GameVisibilityChanged WebSocket event
    it('should change game visibility when GameVisibilityChanged is received', (done) => {
        service.setGames([MOCK_GAME]);

        visibilityChangedCallback({ gameId: '1', isVisible: false });

        service.games$.subscribe((games) => {
            const game = games.find(g => g._id === '1');
            expect(game?.isVisible).toBe(false);
            done();
        });
    });

    // Test applyVisibilityChange method directly
    it('should apply visibility change via applyVisibilityChange', (done) => {
        service.setGames([MOCK_GAME, MOCK_GAME_2]);

        service.applyVisibilityChange('2', true);

        service.games$.subscribe((games) => {
            const game = games.find(g => g._id === '2');
            expect(game?.isVisible).toBe(true);
            done();
        });
    });

    // Visibility change for non-existent game
    it('should not modify list when changing visibility of non-existent game', (done) => {
        service.setGames([MOCK_GAME]);

        visibilityChangedCallback({ gameId: '999', isVisible: false });

        service.games$.subscribe((games) => {
            expect(games.length).toBe(1);
            expect(games[0].isVisible).toBe(true);
            done();
        });
    });

    // Test that games$ is observable
    it('should emit to multiple subscribers', () => {
        const subscriber1Results: Game[][] = [];
        const subscriber2Results: Game[][] = [];

        service.games$.subscribe(games => subscriber1Results.push(games));
        service.games$.subscribe(games => subscriber2Results.push(games));

        service.setGames([MOCK_GAME]);

        expect(subscriber1Results.length).toBeGreaterThan(0);
        expect(subscriber2Results.length).toBeGreaterThan(0);
        expect(subscriber1Results[subscriber1Results.length - 1]).toEqual([MOCK_GAME]);
        expect(subscriber2Results[subscriber2Results.length - 1]).toEqual([MOCK_GAME]);
    });
});
