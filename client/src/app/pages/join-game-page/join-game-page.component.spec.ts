/**
 * Test suite for the JoinGamePageComponent.
 * This component handles the lobby browsing experience, allowing players to view available games and select one to join.
 * The tests simulate network latency asynchronously and verify that WebSocket listeners are correctly bound and unbound to prevent memory leaks.
 * They also validate the state of the active lobbies list as real-time updates arrive, and check routing behaviors when selecting lobbies or confirming a join.
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
        _id: '1', name: 'Test Game', description: 'Test Description', size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic, thumbnail: 'test.png', maxPlayers: 4, grid: [],
        isVisible: true, createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-01-15'), ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'lobby-1', gameId: '1', game: createMockGame(), hostSocketId: 'socket-1',
        playerCount: 2, isLocked: false, players: [], pendingAvatars: {}, chatHistory: [], ...overrides,
    });

    const mockLobbies: Lobby[] = [
        createMockLobby({ lobbyId: 'lobby-1', hostSocketId: 'socket-1', playerCount: 2 }),
        createMockLobby({ lobbyId: 'lobby-2', hostSocketId: 'socket-2', playerCount: 3, game: createMockGame({ gameMode: GameMode.Ctf, name: 'CTF Game' }) }),
    ];

    const randomNetworkLatency = (): number => Math.random() * LATENCY_RANGE + LATENCY_BASE;

    const capturedCallbacks = new Map<string, (...args: unknown[]) => void>();
    const createWebSocketMock = () => {
        const mock = jasmine.createSpyObj('WebSocketService', ['onNamespace', 'offNamespace', 'emitNamespace']);
        mock.onNamespace.and.callFake((_ns: string, event: string, cb: (...args: unknown[]) => void) => { capturedCallbacks.set(event, cb); });
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

    /** Ensures the component successfully instantiates without throwing any errors. */
    it('should create', () => { expect(component).toBeTruthy(); });

    describe('ngOnInit', () => {
        /** Confirms that the component safely hooks into the necessary real-time socket channels during its initialization phase. */
        [JoinGameEvents.UpdatedLobbiesList, JoinGameEvents.LobbyJoined].forEach((event) => {
            it(`should register listener for ${event}`, () => {
                fixture.detectChanges();
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Join, event, jasmine.any(Function));
            });
        });

        /** Verifies the exact count of socket listeners applied to guarantee that no extra, unintended events are being tracked. */
        it(`should register exactly ${EXPECTED_LISTENER_COUNT} listeners`, () => {
            fixture.detectChanges();
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });

        /** Prompts the component to instantly request the most up-to-date lobby state from the server rather than waiting for an eventual broadcast. */
        it('should ask the server for the lobby list right away', () => {
            fixture.detectChanges();
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(SocketNamespace.Join, JoinGameEvents.GetLobbies);
        });
    });

    describe('activeLobbies', () => {
        beforeEach(() => { fixture.detectChanges(); });

        /** Ensures the internal list state initializes cleanly before any server communication takes place. */
        it('should start empty', () => { expect(component.activeLobbies).toEqual([]); });

        /** Validates that the local state synchronizes perfectly when the server successfully dispatches a populated list of lobbies. */
        it('should update when the server sends a lobby list', (done) => {
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies); expect(component.activeLobbies).toEqual(mockLobbies); done(); }, randomNetworkLatency());
        });

        /** Gracefully clears the local UI if the server indicates that all active sessions have been closed or completed. */
        it('should handle an empty list gracefully', (done) => {
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([]); expect(component.activeLobbies).toEqual([]); done(); }, randomNetworkLatency());
        });

        /** Checks that the state handles a single active session properly without relying on array structures that require multiple elements. */
        it('should handle a single lobby', (done) => {
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby()]); expect(component.activeLobbies.length).toBe(1); done(); }, randomNetworkLatency());
        });

        /** Enforces a complete replacement of the local lobby list on updates to prevent the UI from duplicating cards or showing ghost sessions. */
        it('should replace the previous list on new updates', (done) => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            const updated = [createMockLobby({ lobbyId: 'lobby-3', playerCount: 1 })];
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(updated); expect(component.activeLobbies.length).toBe(1); expect(component.activeLobbies[0].lobbyId).toBe('lobby-3'); done(); }, randomNetworkLatency());
        });

        /** Verifies stability by ensuring the component retains only the very last state pushed by the server during rapid, consecutive broadcasts. */
        it('should keep the latest data after rapid successive updates', () => {
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby({ lobbyId: 'batch-1' })]);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby({ lobbyId: 'batch-2' }), createMockLobby({ lobbyId: 'batch-3' })]);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([createMockLobby({ lobbyId: 'batch-4' })]);
            expect(component.activeLobbies.length).toBe(1);
            expect(component.activeLobbies[0].lobbyId).toBe('batch-4');
        });

        /** Validates that the list view supports displaying a heterogeneous mix of both Classic and Capture The Flag game modes without unintentionally filtering them out. */
        it('should preserve different game modes without filtering', (done) => {
            const mixed = [
                createMockLobby({ lobbyId: 'classic', game: createMockGame({ gameMode: GameMode.Classic }) }),
                createMockLobby({ lobbyId: 'ctf', game: createMockGame({ gameMode: GameMode.Ctf }) }),
            ];
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mixed); expect(component.activeLobbies[0].game.gameMode).toBe(GameMode.Classic); expect(component.activeLobbies[1].game.gameMode).toBe(GameMode.Ctf); done(); }, randomNetworkLatency());
        });
    });

    describe('LobbyJoined event', () => {
        beforeEach(() => { spyOn(router, 'navigate'); fixture.detectChanges(); });

        /** Automatically transitions the user's view to the waiting room immediately upon receiving confirmation from the server that their join request was successful. */
        it('should navigate to the waiting room with the lobby data', (done) => {
            const joined = mockLobbies[0];
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.LobbyJoined)?.(joined); expect(router.navigate).toHaveBeenCalledWith([component.routes.waitingRoom, joined.lobbyId], { state: { lobby: joined } }); done(); }, randomNetworkLatency());
        });

        /** Passes the exact lobby object retrieved from the server into the angular router state, ensuring the destination component has all necessary contextual data. */
        it('should pass the actual received lobby in router state', (done) => {
            const joined = createMockLobby({ lobbyId: 'custom-id', playerCount: 4 });
            setTimeout(() => { capturedCallbacks.get(JoinGameEvents.LobbyJoined)?.(joined); const args = (router.navigate as jasmine.Spy).calls.mostRecent().args; expect(args[1]?.state?.lobby).toEqual(joined); done(); }, randomNetworkLatency());
        });
    });

    describe('selectLobby', () => {
        beforeEach(() => { spyOn(router, 'navigate'); fixture.detectChanges(); });

        /** Routes the player to the character creation flow when they actively select a specific lobby from the interface list. */
        mockLobbies.forEach((lobby, i) => {
            it(`should navigate to character-selection for lobby #${i}`, () => {
                component.selectLobby(lobby);
                expect(router.navigate).toHaveBeenCalledWith(['/character-selection', lobby.lobbyId], { state: { game: lobby.game } });
            });
        });

        /** Injects the underlying game configuration into the router state so the character creation screen knows the constraints (like grid size or max players) of the chosen game. */
        it('should include the game object in the router state', () => {
            component.selectLobby(mockLobbies[1]);
            const args = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(args[1]?.state?.game).toEqual(mockLobbies[1].game);
        });

        /** Confirms that the navigation and state passing behavior works flawlessly when the selected lobby is specifically running a Capture The Flag game mode. */
        it('should work for CTF lobbies too', () => {
            const ctf = createMockLobby({ lobbyId: 'ctf-1', game: createMockGame({ gameMode: GameMode.Ctf, name: 'CTF Game' }) });
            component.selectLobby(ctf);
            const args = (router.navigate as jasmine.Spy).calls.mostRecent().args;
            expect(args[1]?.state?.game.gameMode).toBe(GameMode.Ctf);
        });
    });

    describe('ngOnDestroy', () => {
        beforeEach(() => { fixture.detectChanges(); });

        /** Protects the application from memory leaks and ghost updates by strictly removing socket listeners when the component is unmounted. */
        [JoinGameEvents.UpdatedLobbiesList, JoinGameEvents.LobbyJoined].forEach((event) => {
            it(`should unsubscribe from ${event}`, () => {
                fixture.destroy();
                expect(webSocketService.offNamespace).toHaveBeenCalledWith(SocketNamespace.Join, event);
            });
        });

        /** Verifies that the exact same number of listeners created during initialization are properly targeted for destruction. */
        it(`should call offNamespace exactly ${EXPECTED_LISTENER_COUNT} times`, () => {
            fixture.destroy();
            expect(webSocketService.offNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });
    });

    describe('template rendering', () => {
        /** Displays a helpful placeholder text message to inform the player when no online sessions are currently open to join. */
        it('should show "Aucun salon disponible" when the list is empty', () => {
            component.activeLobbies = [];
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucun salon disponible');
        });

        /** Instantiates and displays exactly one LobbyCardComponent for each distinct lobby object present in the state array. */
        it('should render one lobby card per lobby', () => {
            component.activeLobbies = mockLobbies;
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-lobby-card').length).toBe(2);
        });

        /** Seamlessly removes the empty placeholder message as soon as active lobbies are loaded into the component state. */
        it('should not show the empty message when there are lobbies', () => {
            component.activeLobbies = mockLobbies;
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).querySelector('.no-games')).toBeNull();
        });

        /** Verifies the dynamic reactive capabilities of the template by transitioning smoothly from a populated state back down to an empty state. */
        it('should update activeLobbies to empty after receiving an empty list', () => {
            fixture.detectChanges();
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.(mockLobbies);
            expect(component.activeLobbies.length).toBe(2);
            capturedCallbacks.get(JoinGameEvents.UpdatedLobbiesList)?.([]);
            expect(component.activeLobbies.length).toBe(0);
        });

        /** Restores the empty placeholder text accurately if an update from the server wipes out all previously active lobbies. */
        it('should render the empty message when the list is reset to empty', () => {
            component.activeLobbies = [];
            fixture.detectChanges();
            const el = fixture.nativeElement as HTMLElement;
            expect(el.textContent).toContain('Aucun salon disponible');
            expect(el.querySelector('.no-games')).toBeTruthy();
        });

        /** Ensures the primary page header text is correctly rendered in the DOM for user context. */
        it('should render the page title', () => {
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain('Joindre une partie');
        });

        /** Confirms the presence of a clearly identifiable back button to allow users to intuitively exit the page. */
        it('should have a return button', () => {
            fixture.detectChanges();
            const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('app-button');
            expect(Array.from(buttons).some((b) => b.textContent?.includes('Retour'))).toBeTruthy();
        });
    });
});