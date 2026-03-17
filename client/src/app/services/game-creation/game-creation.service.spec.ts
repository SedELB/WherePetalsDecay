/**
 * Test suite for the GameCreationService.
 * This service manages a reactive, dynamically updated list of visible games by intercepting HTTP loads and synchronizing via WebSocket events.
 * The tests use HttpTestingController to intercept the initial API load and verify that the data correctly populates the BehaviorSubject.
 * Furthermore, it simulates real-time events (GameCreated, GameDeleted, GameVisibilityChanged) to guarantee the list appends, purges, and updates games reactively as the admin alters them.
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
        _id: '1', name: 'Visible Game', description: 'Test Description',
        size: { rows: 10, cols: 10 }, gameMode: GameMode.Classic, thumbnail: 'thumb',
        maxPlayers: 2, grid: [], isVisible: true, createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-01-15'),
    };

    const MOCK_GAME_2: Game = {
        _id: '2', name: 'Another Game', description: 'Test Description 2',
        size: { rows: 15, cols: 15 }, gameMode: GameMode.Ctf, thumbnail: 'filler.png',
        maxPlayers: 4, grid: [], isVisible: true, createdAt: new Date('2024-02-10'), updatedAt: new Date('2024-02-10'),
    };

    beforeEach(() => {
        webSocketService = jasmine.createSpyObj('WebSocketService', ['onNamespace']);
        webSocketService.onNamespace.and.callFake(<T>(_ns: string, event: string, cb: (data: T) => void) => {
            if (event === GameCreationEvents.GameCreated) gameCreatedCallback = cb as (game: Game) => void;
            else if (event === GameCreationEvents.GameDeleted) gameDeletedCallback = cb as (gameId: string) => void;
            else if (event === GameCreationEvents.GameVisibilityChanged) visibilityChangedCallback = cb as (d: { gameId: string; isVisible: boolean }) => void;
        });

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [GameCreationService, { provide: WebSocketService, useValue: webSocketService }],
        });
        service = TestBed.inject(GameCreationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => { httpMock.verify(); });

    /** Ensures the service successfully instantiates without throwing any dependency injection errors. */
    it('should create the service', () => { expect(service).toBeTruthy(); });

    /** Verifies that the service immediately binds all three critical administrative listeners to maintain perfect synchronization with the server database. */
    it('should set up all three WebSocket listeners on construction', () => {
        const EXPECTED = 3;
        expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED);
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Games, GameCreationEvents.GameCreated, jasmine.any(Function));
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Games, GameCreationEvents.GameDeleted, jasmine.any(Function));
        expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Games, GameCreationEvents.GameVisibilityChanged, jasmine.any(Function));
    });

    /** Confirms the internal observable stream safely defaults to an empty array before any HTTP fetching or socket events populate it. */
    it('should start with an empty games list', (done) => {
        service.visibleGames$.subscribe((g) => { expect(g).toEqual([]); done(); });
    });

    /** Verifies that manually pushing a dataset via the setter directly cascades down through the observable stream to all listeners. */
    it('should expose games set via setGames', (done) => {
        service.setGames([MOCK_GAME, MOCK_GAME_2]);
        service.visibleGames$.subscribe((g) => { expect(g).toEqual([MOCK_GAME, MOCK_GAME_2]); done(); });
    });

    describe('HTTP', () => {
        /** Instantiates an outgoing HTTP GET request to pull the authoritative baseline list of visible games from the backend. */
        it('should fetch visible games via GET', () => {
            service.fetchVisibleGames().subscribe((g) => { expect(g).toEqual([MOCK_GAME, MOCK_GAME_2]); });
            const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
            expect(req.request.method).toBe('GET');
            req.flush([MOCK_GAME, MOCK_GAME_2]);
        });

        /** Gracefully parses and handles situations where the backend database legitimately returns an empty payload indicating no active games exist. */
        it('should handle an empty response from the API', () => {
            service.fetchVisibleGames().subscribe((g) => { expect(g).toEqual([]); });
            httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`).flush([]);
        });
    });

    describe('GameCreated', () => {
        /** Reactively appends newly created game sessions directly into the local array without requiring a full HTTP refresh. */
        it('should add the new game to the list', (done) => {
            service.setGames([MOCK_GAME]);
            gameCreatedCallback(MOCK_GAME_2);
            service.visibleGames$.subscribe((g) => { expect(g.length).toBe(2); done(); });
        });

        /** Ensures the append logic functions flawlessly even when seeding the very first game into a previously empty list. */
        it('should work on an empty list too', (done) => {
            gameCreatedCallback(MOCK_GAME);
            service.visibleGames$.subscribe((g) => { expect(g.length).toBe(1); done(); });
        });
    });

    describe('GameDeleted', () => {
        /** Filters out and permanently removes a specific game from the active array when the server announces its deletion. */
        it('should remove the deleted game from the list', (done) => {
            service.setGames([MOCK_GAME, MOCK_GAME_2]);
            gameDeletedCallback('1');
            service.visibleGames$.subscribe((g) => { expect(g.length).toBe(1); expect(g[0]._id).toBe('2'); done(); });
        });

        /** Avoids undefined behavior or crashes by failing silently if instructed to delete an ID that doesn't exist locally. */
        it('should not crash when deleting a game that is not in the list', (done) => {
            service.setGames([MOCK_GAME]);
            gameDeletedCallback('999');
            service.visibleGames$.subscribe((g) => { expect(g.length).toBe(1); done(); });
        });

        /** Allows the deletion routine to pass without throwing errors even if the local list is completely empty. */
        it('should handle deletion on an empty list', (done) => {
            gameDeletedCallback('1');
            service.visibleGames$.subscribe((g) => { expect(g.length).toBe(0); done(); });
        });
    });

    describe('Visibility change', () => {
        /** Mimics deletion logic by scrubbing games from the visible roster whenever an admin specifically toggles them to 'hidden'. */
        it('should remove the game when it becomes hidden', (done) => {
            service.setGames([MOCK_GAME, MOCK_GAME_2]);
            visibilityChangedCallback({ gameId: '1', isVisible: false });
            service.visibleGames$.subscribe((g) => { expect(g.find((x) => x._id === '1')).toBeUndefined(); done(); });
        });

        /** Triggers a robust self-healing process by executing a full HTTP re-fetch of the database if a game is suddenly made visible again. */
        it('should re-fetch the full list when a game becomes visible', (done) => {
            service.setGames([MOCK_GAME]);
            visibilityChangedCallback({ gameId: '2', isVisible: true });
            const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
            req.flush([MOCK_GAME, MOCK_GAME_2]);
            done();
        });

        /** Protects the local state by ignoring commands to hide a game if it was never loaded into the array to begin with. */
        it('should not break when hiding a game that is not in the list', (done) => {
            service.setGames([MOCK_GAME]);
            visibilityChangedCallback({ gameId: '999', isVisible: false });
            service.visibleGames$.subscribe((g) => { expect(g.length).toBe(1); done(); });
        });

        /** Verifies the BehaviorSubject's multicast capability, confirming that multiple independent components will all receive identical updates. */
        it('should emit to multiple subscribers', () => {
            const r1: Game[][] = [];
            const r2: Game[][] = [];
            service.visibleGames$.subscribe((g) => r1.push(g));
            service.visibleGames$.subscribe((g) => r2.push(g));
            service.setGames([MOCK_GAME]);
            expect(r1[r1.length - 1]).toEqual([MOCK_GAME]);
            expect(r2[r2.length - 1]).toEqual([MOCK_GAME]);
        });
    });
});