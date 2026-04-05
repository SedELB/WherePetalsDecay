/**
 * JoinGamePageComponent Test Suite
 *
 * Testing Strategy:
 * This component is the page players get to see available games and pick one
 * to join. It listens for live lobby updates over WebSocket and navigates away when the
 * player selects or successfully joins a lobby. We test four things:
 *
 * 1. Lifecycle Hooks - On init, the component registers two socket listeners and asks the
 *    server for the current lobby list. On destroy, it unregisters those same listeners
 *    so we don't leak subscriptions or keep getting updates.
 *
 * 2. Lobby List State - The activeLobbies array should reflect whatever the server last sent.
 *    We cover empty lists, single lobbies, full replacements, successive updates, and
 *    mixed game modes to make sure nothing gets lost or duplicated.
 *
 * 3. Navigation - Selecting a lobby routes to character selection with the game data in state.
 *    When the server confirms a join, we navigate to the waiting room with the full lobby object.
 *
 * 4. Template Rendering - The empty state message, lobby card count, page title, and back
 *    button all need to show up.
 *
 * WebSocket Mocking Strategy:
 * We spy on WebSocketService and capture the callbacks passed to onNamespace. This lets us
 * simulate server events by calling those callbacks directly with test data, optionally
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { JoinGamePageComponent } from './join-game-page.component';

describe('JoinGamePageComponent', () => {
    let component: JoinGamePageComponent;
    let fixture: ComponentFixture<JoinGamePageComponent>;
    let webSocketService: jasmine.SpyObj<WebSocketService>;
    let router: Router;


    const EXPECTED_LISTENER_COUNT = 2;

    const createMockGame = (overrides: Partial<Game> = {}): Game => ({
        _id: '1', name: 'Test Game', description: 'Test Description', size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic, thumbnail: 'test.png', maxPlayers: 4, grid: [],
        isVisible: true, createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-01-15'), ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'lobby-1', gameId: '1', game: createMockGame(), hostSocketId: 'socket-1',
        playerCount: 2, isLocked: false, players: [], pendingAvatars: {}, chatHistory: [],
        teamA: [], teamB: [], ...overrides,
    });

    const mockLobbies: Lobby[] = [
        createMockLobby({ lobbyId: 'lobby-1', hostSocketId: 'socket-1', playerCount: 2 }),
        createMockLobby({
            lobbyId: 'lobby-2', hostSocketId: 'socket-2', playerCount: 3,
            game: createMockGame({ gameMode: GameMode.Ctf, name: 'CTF Game' }),
        }),
    ];

    const capturedCallbacks = new Map<string, (...args: unknown[]) => void>();
    const createWebSocketMock = () => {
        const mock = jasmine.createSpyObj('WebSocketService', ['onNamespace', 'offNamespace', 'emitNamespace']);
        mock.onNamespace.and.callFake((_ns: string, event: string, cb: (...args: unknown[]) => void) => {
            capturedCallbacks.set(event, cb);
        });
        return mock;
    };

    beforeEach(async () => {
        capturedCallbacks.clear();
        await TestBed.configureTestingModule({
            imports: [JoinGamePageComponent],
            providers: [provideRouter([]), { provide: WebSocketService, useValue: createWebSocketMock() }],
        }).compileComponents();

        webSocketService = TestBed.inject(WebSocketService) as jasmine.SpyObj<WebSocketService>;
        router = TestBed.inject(Router);
        fixture = TestBed.createComponent(JoinGamePageComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });


    // Initialization
    //
    // On init the component hooks into the Join namespace for two events and immediately
    // asks the server for the current lobby list. We verify all three things happen.

    describe('ngOnInit', () => {
        // Make sure we're listening for both events
        [JoinGameEvents.UpdatedLobbiesList, JoinGameEvents.LobbyJoined].forEach((event) => {
            it(`should register listener for ${event}`, () => {
                fixture.detectChanges();
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Join, event, jasmine.any(Function));
            });
        });

        // No extra listeners - we only want exactly the two we registered
        it(`should register exactly ${EXPECTED_LISTENER_COUNT} listeners`, () => {
            fixture.detectChanges();
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });

        // The component should fetch lobbies right away so the user doesn't stare at an empty page
        it('should ask the server for the lobby list right away', () => {
            fixture.detectChanges();
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(SocketNamespace.Join, JoinGameEvents.GetLobbies);
        });
    });


    // Active Lobbies State
    //
    // The lobby list comes from the server via WebSocket. These tests make sure
    // the component correctly stores what the server sends - including edge
    // cases like empty lists, single items and mixed game modes.

    describe('activeLobbies', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should start empty', () => {
            expect(component.activeLobbies).toEqual([]);
        });

        // Normal case: server sends a list, we store it
        it('should update when the server sends a lobby list', () => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            expect(component.activeLobbies).toEqual(mockLobbies);
        });

        // Empty array from server shouldn't cause issues
        it('should handle an empty list gracefully', () => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([]);
            expect(component.activeLobbies).toEqual([]);
        });

        it('should handle a single lobby', () => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby()]);
            expect(component.activeLobbies.length).toBe(1);
        });

        // Each update should fully replace the old list, not merge or append
        it('should replace the previous list on new updates', () => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            const updated = [createMockLobby({ lobbyId: 'lobby-3', playerCount: 1 })];

            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(updated);
            expect(component.activeLobbies.length).toBe(1);
            expect(component.activeLobbies[0].lobbyId).toBe('lobby-3');
        });

        // If multiple updates come in at the same time, we should only keep the last one
        it('should keep the latest data after rapid successive updates', () => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby({ lobbyId: 'batch-1' })]);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([
                createMockLobby({ lobbyId: 'batch-2' }),
                createMockLobby({ lobbyId: 'batch-3' }),
            ]);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby({ lobbyId: 'batch-4' })]);

            expect(component.activeLobbies.length).toBe(1);
            expect(component.activeLobbies[0].lobbyId).toBe('batch-4');
        });

        // Both Classic and CTF lobbies should exist at the same time
        it('should preserve different game modes without filtering', () => {
            const mixed = [
                createMockLobby({ lobbyId: 'classic', game: createMockGame({ gameMode: GameMode.Classic }) }),
                createMockLobby({ lobbyId: 'ctf', game: createMockGame({ gameMode: GameMode.Ctf }) }),
            ];

            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mixed);
            expect(component.activeLobbies[0].game.gameMode).toBe(GameMode.Classic);
            expect(component.activeLobbies[1].game.gameMode).toBe(GameMode.Ctf);
        });
    });


    // LobbyJoined Navigation
    //
    // When the server confirms we joined a lobby, the component should navigate
    // to the waiting room and pass the lobby data through router state.

    describe('LobbyJoined event', () => {
        beforeEach(() => {
            spyOn(router, 'navigate');
            fixture.detectChanges();
        });

        it('should navigate to the waiting room with the lobby data', () => {
            const joined = mockLobbies[0];
            capturedCallbacks.get(JoinGameEvents.LobbyJoined)?.(joined);
            expect(router.navigate).toHaveBeenCalledWith(
                [component.routes.waitingRoom, joined.lobbyId],
                { state: { lobby: joined } },
            );
        });

        // The exact lobby object from the server should end up in router state
        it('should pass the actual received lobby in router state', () => {
            const joined = createMockLobby({ lobbyId: 'custom-id', playerCount: 4 });
            capturedCallbacks.get(JoinGameEvents.LobbyJoined)?.(joined);
            const args = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(args[1]?.state?.lobby).toEqual(joined);
        });
    });


    // Lobby Selection
    //
    // Clicking a lobby card routes to character selection so the player can
    // create their character before actually joining. The game config goes
    // in router state so the next page knows th data it receive.

    describe('selectLobby', () => {
        beforeEach(() => {
            spyOn(router, 'navigate');
            fixture.detectChanges();
        });

        mockLobbies.forEach((lobby, i) => {
            it(`should navigate to character-selection for lobby #${i}`, () => {
                component.selectLobby(lobby);
                expect(router.navigate).toHaveBeenCalledWith(
                    ['/character-selection', lobby.lobbyId],
                    { state: { game: lobby.game } },
                );
            });
        });

        // The game object should be in state so character selection knows the game config
        it('should include the game object in the router state', () => {
            component.selectLobby(mockLobbies[1]);
            const args = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(args[1]?.state?.game).toEqual(mockLobbies[1].game);
        });

        // CTF lobbies should work the same way as Classic ones
        it('should work for CTF lobbies too', () => {
            const ctf = createMockLobby({ lobbyId: 'ctf-1', game: createMockGame({ gameMode: GameMode.Ctf, name: 'CTF Game' }) });
            component.selectLobby(ctf);
            const args = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(args[1]?.state?.game.gameMode).toBe(GameMode.Ctf);
        });
    });


    // Cleanup
    //
    // When the component is destroyed we need to unregister the socket listeners,
    // otherwise we'd keep getting updates for a page that no longer exists.

    describe('ngOnDestroy', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        [JoinGameEvents.UpdatedLobbiesList, JoinGameEvents.LobbyJoined].forEach((event) => {
            it(`should unsubscribe from ${event}`, () => {
                fixture.destroy();
                expect(webSocketService.offNamespace).toHaveBeenCalledWith(SocketNamespace.Join, event);
            });
        });

        // Same number of off calls as on calls
        it(`should call offNamespace exactly ${EXPECTED_LISTENER_COUNT} times`, () => {
            fixture.destroy();
            expect(webSocketService.offNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });
    });


    // Template Rendering
    //
    // DOM checks: empty state message, correct number of lobby cards,
    // page title, and the back button.

    describe('template rendering', () => {
        // When there are no lobbies, the user should see a message instead of a blank page
        it('should show "Aucun salon disponible" when the list is empty', () => {
            component.activeLobbies = [];
            component.isReady = true;
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucun salon disponible');
        });

        // One card per lobby
        it('should render one lobby card per lobby', () => {
            component.activeLobbies = mockLobbies;
            component.isReady = true;
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-lobby-card').length).toBe(2);
        });

        // The empty message should disappear once we have actual lobbies to show
        it('should not show the empty message when there are lobbies', () => {
            component.activeLobbies = mockLobbies;
            component.isReady = true;
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).querySelector('.no-games')).toBeNull();
        });

        // Going from "has lobbies" back to "empty" should work
        it('should update activeLobbies to empty after receiving an empty list', () => {
            fixture.detectChanges();
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            expect(component.activeLobbies.length).toBe(2);

            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([]);
            expect(component.activeLobbies.length).toBe(0);
        });

        // The empty state placeholder should come back if all lobbies disappear
        it('should render the empty message when the list is reset to empty', () => {
            component.activeLobbies = [];
            component.isReady = true;
            fixture.detectChanges();
            const el = fixture.nativeElement as HTMLElement;
            expect(el.textContent).toContain('Aucun salon disponible');
            expect(el.querySelector('.no-games')).toBeTruthy();
        });

        it('should render the page title', () => {
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain('Joindre une partie');
        });

        it('should have a return button', () => {
            fixture.detectChanges();
            const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('app-button');
            expect(buttons.length).toBeGreaterThan(0);
        });
    });
});
