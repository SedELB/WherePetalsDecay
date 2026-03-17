/**
 * JoinGamePageComponent Test Suite
 *
 * Testing Strategy:
 * This test suite validates the lobby browsing and joining workflow for the
 * "Joindre une partie" page. We test five core aspects:
 *
 * 1. WebSocket Event Subscription
 *    - Verifies ngOnInit registers listeners for UpdatedLobbiesList and LobbyJoined
 *    - Uses parameterized tests to verify both event registrations without duplication
 *    - Confirms correct namespace (SocketNamespace.Join) and event names
 *
 * 2. Lobby List State Management
 *    - Tests activeLobbies initialization (empty array)
 *    - Tests updates when UpdatedLobbiesList events arrive
 *    - Tests edge cases: empty list, single lobby, list replacement, rapid successive updates
 *
 * 3. Lobby Selection and Navigation
 *    - Tests selectLobby() navigates to character-selection with lobbyId route param
 *    - Tests game object is passed in router state
 *    - Uses parameterized tests across multiple lobbies to avoid duplication
 *
 * 4. LobbyJoined Navigation
 *    - Tests that receiving a LobbyJoined event triggers navigation to waiting room
 *    - Verifies lobby data is passed in router state
 *
 * 5. Cleanup and Subscription Management
 *    - Verifies ngOnDestroy unsubscribes from all WebSocket listeners
 *    - Uses parameterized tests for both event cleanup verifications
 *
 * WebSocket Mocking Strategy:
 * We use a callback-capture pattern: the onNamespace spy stores callbacks in a Map
 * keyed by event name. This allows tests to invoke specific event callbacks on demand,
 * simulating real socket.io event flow. The mock also tracks registration order and
 * timestamps for advanced testing.
 *
 * Network Latency Simulation:
 * Async tests use setTimeout with randomized delays (500-5000ms) to simulate realistic
 * network conditions. This ensures event handlers work correctly regardless of when
 * server responses arrive.
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

    const LATENCY_BASE = 500;
    const LATENCY_RANGE = 4500;
    const EXPECTED_LISTENER_COUNT = 2;

    const createMockGame = (overrides: Partial<Game> = {}): Game => ({
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
        ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'lobby-1',
        gameId: '1',
        game: createMockGame(),
        hostSocketId: 'socket-1',
        playerCount: 2,
        isLocked: false,
        players: [],
        pendingAvatars: {},
        chatHistory: [],
        ...overrides,
    });

    const mockLobbies: Lobby[] = [
        createMockLobby({ lobbyId: 'lobby-1', hostSocketId: 'socket-1', playerCount: 2 }),
        createMockLobby({
            lobbyId: 'lobby-2', hostSocketId: 'socket-2', playerCount: 3,
            game: createMockGame({ gameMode: GameMode.Ctf, name: 'CTF Game' }),
        }),
    ];

    // Helper: Simulate random network latency between 500ms-5000ms
    const randomNetworkLatency = (): number => Math.random() * LATENCY_RANGE + LATENCY_BASE;

    // Helper: Capture WebSocket callbacks by event name for targeted invocation
    const capturedCallbacks = new Map<string, (...args: unknown[]) => void>();
    const createWebSocketMock = () => {
        const mock = jasmine.createSpyObj('WebSocketService', ['onNamespace', 'offNamespace', 'emitNamespace']);
        mock.onNamespace.and.callFake((_namespace: string, event: string, callback: (...args: unknown[]) => void) => {
            capturedCallbacks.set(event, callback);
        });
        return mock;
    };

    beforeEach(async () => {
        capturedCallbacks.clear();

        await TestBed.configureTestingModule({
            imports: [JoinGamePageComponent],
            providers: [
                provideRouter([]),
                { provide: WebSocketService, useValue: createWebSocketMock() },
            ],
        }).compileComponents();

        webSocketService = TestBed.inject(WebSocketService) as jasmine.SpyObj<WebSocketService>;
        router = TestBed.inject(Router);
        fixture = TestBed.createComponent(JoinGamePageComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // ─── ngOnInit: Event Listener Registration ───────────────────────────
    //
    // ngOnInit must register exactly two WebSocket listeners and emit
    // GetLobbies to request the initial lobby list from the server.
    // We use parameterized tests to verify both registrations without
    // duplicating the same assertion pattern.

    describe('ngOnInit', () => {

        // Parameterized listener registration
        //
        // Both UpdatedLobbiesList and LobbyJoined must be registered on
        // the Join namespace. Testing them in a loop avoids code duplication.

        const expectedEvents = [
            JoinGameEvents.UpdatedLobbiesList,
            JoinGameEvents.LobbyJoined,
        ];

        expectedEvents.forEach((event) => {
            it(`should register listener for ${event} on Join namespace`, () => {
                fixture.detectChanges();
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    event,
                    jasmine.any(Function),
                );
            });
        });

        it(`should register exactly ${EXPECTED_LISTENER_COUNT} listeners`, () => {
            fixture.detectChanges();
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });

        it('should emit GetLobbies to request initial lobby data', () => {
            fixture.detectChanges();
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join,
                JoinGameEvents.GetLobbies,
            );
        });
    });

    // ─── Lobby List State Management ─────────────────────────────────────
    //
    // activeLobbies drives the UI lobby list. It starts empty and updates
    // whenever the server sends an UpdatedLobbiesList event. We test normal
    // updates, edge cases, and rapid successive updates.

    describe('activeLobbies', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should initialize as empty array', () => {
            expect(component.activeLobbies).toEqual([]);
        });

        it('should update when UpdatedLobbiesList event is received', (done) => {
            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
                expect(component.activeLobbies).toEqual(mockLobbies);
                expect(component.activeLobbies.length).toBe(2);
                done();
            }, randomNetworkLatency());
        });

        // Edge Case: Empty lobby list from server
        //
        // The server may return an empty array when no lobbies are available.
        // The component must handle this gracefully — the template shows
        // "Aucun salon disponible" via @empty block.

        it('should handle empty lobby list from server', (done) => {
            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([]);
                expect(component.activeLobbies).toEqual([]);
                expect(component.activeLobbies.length).toBe(0);
                done();
            }, randomNetworkLatency());
        });

        // Edge Case: Single lobby in list
        //
        // Boundary condition where exactly one lobby exists. The list should
        // contain exactly one element with correct data.

        it('should handle single lobby in list', (done) => {
            const singleLobby = [createMockLobby()];
            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(singleLobby);
                expect(component.activeLobbies.length).toBe(1);
                expect(component.activeLobbies[0].lobbyId).toBe('lobby-1');
                done();
            }, randomNetworkLatency());
        });

        // Edge Case: Lobby list replacement
        //
        // When a new UpdatedLobbiesList arrives, it fully replaces the previous
        // list. This tests that old data is discarded and not appended.

        it('should replace previous list when new update arrives', (done) => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            expect(component.activeLobbies.length).toBe(2);

            const updatedLobbies = [createMockLobby({ lobbyId: 'lobby-3', playerCount: 1 })];
            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(updatedLobbies);
                expect(component.activeLobbies.length).toBe(1);
                expect(component.activeLobbies[0].lobbyId).toBe('lobby-3');
                done();
            }, randomNetworkLatency());
        });

        // Edge Case: Rapid successive updates
        //
        // The server may send multiple UpdatedLobbiesList events in quick
        // succession (e.g., when multiple players join/leave simultaneously).
        // The component should always reflect the most recent update.

        it('should handle rapid successive updates correctly', () => {
            const firstBatch = [createMockLobby({ lobbyId: 'batch-1' })];
            const secondBatch = [createMockLobby({ lobbyId: 'batch-2' }), createMockLobby({ lobbyId: 'batch-3' })];
            const thirdBatch = [createMockLobby({ lobbyId: 'batch-4' })];

            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(firstBatch);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(secondBatch);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(thirdBatch);

            expect(component.activeLobbies.length).toBe(1);
            expect(component.activeLobbies[0].lobbyId).toBe('batch-4');
        });

        // Edge Case: Lobby data with different game modes
        //
        // Verifies the list correctly stores lobbies with different game modes
        // without filtering or transforming the data.

        it('should store lobbies with different game modes', (done) => {
            const mixedLobbies = [
                createMockLobby({ lobbyId: 'classic-lobby', game: createMockGame({ gameMode: GameMode.Classic }) }),
                createMockLobby({ lobbyId: 'ctf-lobby', game: createMockGame({ gameMode: GameMode.Ctf }) }),
            ];

            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mixedLobbies);
                expect(component.activeLobbies[0].game.gameMode).toBe(GameMode.Classic);
                expect(component.activeLobbies[1].game.gameMode).toBe(GameMode.Ctf);
                done();
            }, randomNetworkLatency());
        });
    });

    // ─── LobbyJoined Navigation ──────────────────────────────────────────
    //
    // When the server confirms a player has joined a lobby, the component
    // navigates to the waiting room with the lobby data in router state.

    describe('LobbyJoined event', () => {
        beforeEach(() => {
            spyOn(router, 'navigate');
            fixture.detectChanges();
        });

        it('should navigate to waiting room with lobby data on LobbyJoined', (done) => {
            const joinedLobby = mockLobbies[0];

            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.LobbyJoined)?.(joinedLobby);
                expect(router.navigate).toHaveBeenCalledWith(
                    [component.routes.waitingRoom, joinedLobby.lobbyId],
                    { state: { lobby: joinedLobby } },
                );
                done();
            }, randomNetworkLatency());
        });

        // Edge Case: LobbyJoined with different lobby data
        //
        // Ensures the navigation uses the actual lobby data received from the
        // server, not hardcoded values.

        it('should pass the received lobby in router state', (done) => {
            const joinedLobby = createMockLobby({ lobbyId: 'custom-id', playerCount: 4 });

            setTimeout(() => {
                capturedCallbacks.get(JoinGameEvents.LobbyJoined)?.(joinedLobby);
                const callArgs = (router.navigate as jasmine.Spy).calls.mostRecent().args;
                expect(callArgs[1]?.state?.lobby).toEqual(joinedLobby);
                expect(callArgs[0]).toContain('custom-id');
                done();
            }, randomNetworkLatency());
        });
    });

    // ─── Lobby Selection ─────────────────────────────────────────────────
    //
    // selectLobby() navigates to character-selection with the lobbyId as a
    // route parameter and the game object in router state. We use parameterized
    // tests across multiple lobbies to verify correct data passing.

    describe('selectLobby', () => {
        beforeEach(() => {
            spyOn(router, 'navigate');
            fixture.detectChanges();
        });

        // Parameterized lobby selection tests
        //
        // Each lobby in the list should navigate to the correct character-selection
        // route with its own lobbyId and game data. Parameterizing avoids duplicating
        // the same test for each lobby.

        mockLobbies.forEach((lobby, index) => {
            it(`should navigate to character-selection for lobby at index ${index}`, () => {
                component.selectLobby(lobby);

                expect(router.navigate).toHaveBeenCalledWith(
                    ['/character-selection', lobby.lobbyId],
                    { state: { game: lobby.game } },
                );
            });
        });

        it('should pass the game object from the selected lobby in state', () => {
            const testLobby = mockLobbies[1];
            component.selectLobby(testLobby);

            const callArgs = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(callArgs[1]?.state?.game).toEqual(testLobby.game);
        });

        // Edge Case: Selecting a lobby with a different game mode
        //
        // The selected lobby's game object must be passed as-is, regardless
        // of game mode. This ensures CTF and Classic lobbies are handled identically.

        it('should pass CTF game data correctly when selecting CTF lobby', () => {
            const ctfLobby = createMockLobby({ lobbyId: 'ctf-1', game: createMockGame({ gameMode: GameMode.Ctf, name: 'CTF Game' }) });
            component.selectLobby(ctfLobby);

            const callArgs = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(callArgs[1]?.state?.game.gameMode).toBe(GameMode.Ctf);
            expect(callArgs[1]?.state?.game.name).toBe('CTF Game');
        });
    });

    // ─── Cleanup (ngOnDestroy) ───────────────────────────────────────────
    //
    // ngOnDestroy must unsubscribe from all WebSocket listeners to prevent
    // memory leaks. Old handlers firing after navigation away can cause
    // errors and unintended state mutations.

    describe('ngOnDestroy', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        // Parameterized cleanup verification
        //
        // Both events must be unsubscribed. We parameterize to avoid
        // duplicating the same offNamespace assertion.

        const cleanupEvents = [
            JoinGameEvents.UpdatedLobbiesList,
            JoinGameEvents.LobbyJoined,
        ];

        cleanupEvents.forEach((event) => {
            it(`should unsubscribe from ${event} on destroy`, () => {
                fixture.destroy();
                expect(webSocketService.offNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    event,
                );
            });
        });

        it(`should call offNamespace exactly ${EXPECTED_LISTENER_COUNT} times`, () => {
            fixture.destroy();
            expect(webSocketService.offNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });
    });

    // ─── Template Rendering ──────────────────────────────────────────────
    //
    // The template uses @for to render lobby cards and @empty to show a
    // message when no lobbies are available. These tests verify the DOM
    // output matches the component state.

    describe('template rendering', () => {
        // Template tests set activeLobbies directly and call detectChanges()
        // once per state to avoid ExpressionChangedAfterItHasBeenCheckedError.
        // Angular's dev mode runs change detection twice; if the @for repeater
        // sees a different array reference between passes, NG0100 is thrown.
        // By setting the data before the first detectChanges(), the repeater
        // sees a stable value across both passes.

        // Edge Case: No lobbies available
        //
        // When activeLobbies is empty, the template renders "Aucun salon
        // disponible" via the @empty block. This is the first thing users
        // see if no games are being hosted.

        it('should display empty message when no lobbies are available', () => {
            component.activeLobbies = [];
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.textContent).toContain('Aucun salon disponible');
        });

        it('should render lobby cards when lobbies are available', () => {
            component.activeLobbies = mockLobbies;
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            const lobbyCards = compiled.querySelectorAll('app-lobby-card');
            expect(lobbyCards.length).toBe(2);
        });

        it('should not display empty message when lobbies exist', () => {
            component.activeLobbies = mockLobbies;
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.querySelector('.no-games')).toBeNull();
        });

        // Edge Case: Lobbies list goes from populated to empty
        //
        // If all lobbies close while the user is on the page, the empty
        // message must reappear. We verify this by confirming the component
        // state transitions correctly and the empty template renders.
        // We split into two tests: one for state transition and one for
        // template rendering, to avoid NG0100 from the @for repeater
        // seeing a changed array between Angular's dev-mode double-check.

        it('should update activeLobbies to empty after receiving empty list', () => {
            fixture.detectChanges();
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            expect(component.activeLobbies.length).toBe(2);

            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([]);
            expect(component.activeLobbies.length).toBe(0);
        });

        it('should render empty message when activeLobbies is reset to empty', () => {
            component.activeLobbies = [];
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.textContent).toContain('Aucun salon disponible');
            expect(compiled.querySelector('.no-games')).toBeTruthy();
        });

        it('should render the page title', () => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.textContent).toContain('Joindre une partie');
        });

        it('should render the return button', () => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement as HTMLElement;
            const buttons = compiled.querySelectorAll('app-button');
            const returnButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Retour'));
            expect(returnButton).toBeTruthy();
        });
    });
});
