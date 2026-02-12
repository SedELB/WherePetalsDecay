/**
 * Testing:
 * - HTTP API calls for game management
 * - getAllGames, getVisibleGames, getGameById
 * - createGame, modifyGame, deleteGame, updateVisibility
 */

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameMode } from '@common/enums';
import { environment } from 'src/environments/environment';

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
    name: 'Another Game',
    description: 'Description 2',
    size: { rows: 15, cols: 15 },
    gameMode: GameMode.Ctf,
    thumbnail: 'filler.png',
    maxPlayers: 2,
    grid: [],
    isVisible: false,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-02-10'),
};

describe('CommunicationService', () => {
    let httpMock: HttpTestingController;
    let service: CommunicationService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
        });
        service = TestBed.inject(CommunicationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test getAllGames get request
    it('should fetch all games via http get', () => {
        const mockGames = [MOCK_GAME, MOCK_GAME_2];

        service.getAllGames().subscribe((games) => {
            expect(games).toEqual(mockGames);
            expect(games.length).toBe(2);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/allGames`);
        expect(req.request.method).toBe('GET');
        req.flush(mockGames);
    });

    // Empty array from getAllGames
    it('should handle empty array from getAllGames', () => {
        service.getAllGames().subscribe((games) => {
            expect(games).toEqual([]);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/allGames`);
        req.flush([]);
    });

    // Test getVisibleGames get request
    it('should fetch visible games via http get', () => {
        const mockGames = [MOCK_GAME];

        service.getVisibleGames().subscribe((games) => {
            expect(games).toEqual(mockGames);
            expect(games.every((g) => g.isVisible)).toBe(true);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
        expect(req.request.method).toBe('GET');
        req.flush(mockGames);
    });

    // Empty array from getVisibleGames
    it('should handle empty array from getVisibleGames', () => {
        service.getVisibleGames().subscribe((games) => {
            expect(games).toEqual([]);
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/visibleGames`);
        req.flush([]);
    });

    // Test getGameById get request
    it('should fetch single game by ID via http get', () => {
        service.getGameById('1').subscribe((game) => {
            expect(game).toEqual(MOCK_GAME);
            expect(game._id).toBe('1');
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/singleGame/1`);
        expect(req.request.method).toBe('GET');
        req.flush(MOCK_GAME);
    });

    // Test getGameById with different id
    it('should fetch game with correct id parameter', () => {
        service.getGameById('123').subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/singleGame/123`);
        expect(req.request.method).toBe('GET');
        req.flush(MOCK_GAME);
    });

    // Test deleteGame delete request
    it('should delete game via http delete', () => {
        service.deleteGame('1').subscribe((response) => {
            expect(response).toBeNull();
        });

        const req = httpMock.expectOne(`${environment.serverUrl}/game/1`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
    });

    // Test deleteGame with different id
    it('should delete game with correct id parameter', () => {
        service.deleteGame('999').subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/999`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
    });

    // Test updateVisibility patch request
    it('should toggle visibility to false via http patch', () => {
        const visibleGame = { ...MOCK_GAME, isVisible: true };

        service.updateVisiblity(visibleGame).subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/modifyVisibility/1`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ isVisible: false });
        req.flush(null);
    });

    // Test updateVisibility toggles to true
    it('should toggle visibility to true via http patch', () => {
        const hiddenGame = { ...MOCK_GAME, isVisible: false };

        service.updateVisiblity(hiddenGame).subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/modifyVisibility/1`);
        expect(req.request.body).toEqual({ isVisible: true });
        req.flush(null);
    });

    // Test createGame post request
    it('should create game via http post with correct dto', () => {
        service.createGame(MOCK_GAME).subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/addGame`);
        expect(req.request.method).toBe('POST');

        const body = req.request.body;
        expect(body.name).toBe(MOCK_GAME.name);
        expect(body.description).toBe(MOCK_GAME.description);
        expect(body.size).toEqual(MOCK_GAME.size);
        expect(body.gameMode).toBe(MOCK_GAME.gameMode);
        expect(body.thumbnail).toBe(MOCK_GAME.thumbnail);
        expect(body.maxPlayers).toBe(MOCK_GAME.maxPlayers);
        expect(body.grid).toEqual(MOCK_GAME.grid);
        expect(body.isVisible).toBe(MOCK_GAME.isVisible);

        // DTO should not include _id, createdAt and updatedAt
        expect(body._id).toBeUndefined();
        expect(body.createdAt).toBeUndefined();
        expect(body.updatedAt).toBeUndefined();

        req.flush(null);
    });

    // Test modifyGame patch request
    it('should modify game via http patch with correct dto', () => {
        service.modifyGame(MOCK_GAME).subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/modifyGame/1`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.responseType).toBe('text');

        const body = req.request.body;
        expect(body.name).toBe(MOCK_GAME.name);
        expect(body.description).toBe(MOCK_GAME.description);
        expect(body.size).toEqual(MOCK_GAME.size);
        expect(body.gameMode).toBe(MOCK_GAME.gameMode);
        expect(body.thumbnail).toBe(MOCK_GAME.thumbnail);
        expect(body.maxPlayers).toBe(MOCK_GAME.maxPlayers);
        expect(body.grid).toEqual(MOCK_GAME.grid);
        expect(body.isVisible).toBe(MOCK_GAME.isVisible);

        // DTO should not include _id, createdAt and updatedAt
        expect(body._id).toBeUndefined();
        expect(body.createdAt).toBeUndefined();
        expect(body.updatedAt).toBeUndefined();

        req.flush('success');
    });

    // Test modifyGame uses correct game id
    it('should modify game with correct id parameter', () => {
        const gameWithId = { ...MOCK_GAME, _id: '456' };

        service.modifyGame(gameWithId).subscribe();

        const req = httpMock.expectOne(`${environment.serverUrl}/game/modifyGame/456`);
        expect(req.request.method).toBe('PATCH');
        req.flush('success');
    });

    // Test that all API calls use the correct base url
    it('should use environment serverUrl for all requests', () => {
        service.getAllGames().subscribe();
        service.getVisibleGames().subscribe();
        service.getGameById('1').subscribe();
        service.deleteGame('1').subscribe();
        service.updateVisiblity(MOCK_GAME).subscribe();
        service.createGame(MOCK_GAME).subscribe();
        service.modifyGame(MOCK_GAME).subscribe();

        const requests = httpMock.match(() => true);
        requests.forEach((req) => {
            expect(req.request.url).toContain(environment.serverUrl);
        });

        requests.forEach((req) => req.flush(null));
    });
});
