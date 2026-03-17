/**
 * WaitingRoomComponent Test Suite — Part 1: Initialization & WebSocket Listeners
 *
 * Testing Strategy:
 * This test suite validates the waiting room page where players wait before a game starts.
 * Part 1 covers:
 *
 * 1. Initialization and Navigation Guards - Verifies that ngOnInit correctly reads the
 *    lobbyId from the route, checks sessionStorage for F5 protection, and redirects to
 *    home when required data is missing.
 *
 * 2. WebSocket Event Listeners - Tests that setupUpdateListeners registers handlers for
 *    five events: LobbyUpdated, LobbyStatusReceived, GameStarting, PlayerKicked,
 *    and GameDeleted. Each listener updates component state or triggers navigation.
 *
 * WebSocket Mocking Strategy:
 * We mock WebSocketService with jasmine spies that use callFake to capture event
 * callbacks by event name. This allows tests to manually invoke specific callbacks
 * to simulate server events while maintaining test isolation. The getSocketId spy
 * returns a fixed socket ID to enable computed signal testing.
 *
 * Network Latency Simulation:
 * Async tests use setTimeout with randomized delays (500-5000ms) to simulate
 * realistic network conditions when testing WebSocket event handling.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { ChatService } from '@app/services/chat/chat.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { WaitingRoomComponent } from './waiting-room.component';

const BASE_4500 = 4500;
const BASE_500 = 500;

describe('WaitingRoomComponent - Initialization & Listeners', () => {
    let component: WaitingRoomComponent;
    let fixture: ComponentFixture<WaitingRoomComponent>;
    let webSocketService: jasmine.SpyObj<WebSocketService>;
    let chatService: jasmine.SpyObj<ChatService>;
    let gameViewService: jasmine.SpyObj<GameViewService>;
    let router: Router;

    const HOST_SOCKET_ID = 'host-socket-1';
    const PLAYER_SOCKET_ID = 'player-socket-2';
    const LOBBY_ID = 'ABCDE';

    const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
        socketId: HOST_SOCKET_ID,
        isHost: true,
        winsCount: 0,
        hasAbandonned: false,
        character: {
            name: 'TestPlayer',
            avatar: './assets/avatars/archer.png',
            life: 8,
            speed: 6,
            attack: 4,
            defense: 4,
            lifeBonus: true,
            attackDice: 'D6',
            defenseDice: 'D4',
        },
        ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: LOBBY_ID,
        gameId: 'game-1',
        hostSocketId: HOST_SOCKET_ID,
        playerCount: 2,
        isLocked: false,
        pendingAvatars: {},
        players: [
            createMockPlayer(),
            createMockPlayer({
                socketId: PLAYER_SOCKET_ID, isHost: false,
                character: {
                    name: 'Player2', avatar: './assets/avatars/mage.png',
                    life: 6, speed: 8, attack: 4, defense: 4,
                    lifeBonus: false, attackDice: 'D4', defenseDice: 'D6',
                },
            }),
        ],
        game: {
            _id: 'game-1',
            name: 'Test Game',
            description: 'A test game',
            size: { rows: 10, cols: 10 },
            gameMode: GameMode.Classic,
            thumbnail: 'thumb.png',
            maxPlayers: 4,
            grid: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isVisible: true,
        },
        chatHistory: [],
        ...overrides,
    });

    // Helper: Simulate random network latency between 500ms-5000ms for realistic async testing
    const randomNetworkLatency = (): number => {
        return Math.random() * BASE_4500 + BASE_500;
    };

    // Helper: Capture WebSocket event callbacks by event name
    const capturedCallbacks = new Map<string, (...args: unknown[]) => void>();
    const createWebSocketMock = () => {
        const mock = jasmine.createSpyObj('WebSocketService', [
            'onNamespace', 'offNamespace', 'emitNamespace', 'getSocketId',
        ]);
        mock.onNamespace.and.callFake(
            (_namespace: string, event: string, callback: (...args: unknown[]) => void) => {
                capturedCallbacks.set(event, callback);
            },
        );
        mock.getSocketId.and.returnValue(HOST_SOCKET_ID);
        return mock;
    };

    beforeEach(async () => {
        capturedCallbacks.clear();
        const webSocketMock = createWebSocketMock();
        const chatMock = jasmine.createSpyObj('ChatService', ['requestHistory']);
        const gameViewMock = jasmine.createSpyObj('GameViewService', ['setLobby']);

        await TestBed.configureTestingModule({
            imports: [WaitingRoomComponent],
            providers: [
                provideRouter([]),
                { provide: WebSocketService, useValue: webSocketMock },
                { provide: ChatService, useValue: chatMock },
                { provide: GameViewService, useValue: gameViewMock },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: { get: () => LOBBY_ID } } },
                },
            ],
        }).compileComponents();

        webSocketService = TestBed.inject(WebSocketService) as jasmine.SpyObj<WebSocketService>;
        chatService = TestBed.inject(ChatService) as jasmine.SpyObj<ChatService>;
        gameViewService = TestBed.inject(GameViewService) as jasmine.SpyObj<GameViewService>;
        router = TestBed.inject(Router);

        fixture = TestBed.createComponent(WaitingRoomComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // Initialization Tests
    //
    // These tests verify that ngOnInit correctly reads route params, checks
    // sessionStorage for F5 protection, and sets up the lobby from navigation state.

    describe('ngOnInit', () => {
        // Edge Case: Missing lobbyId in route
        //
        // When the URL has no lobbyId parameter, the component must redirect
        // to the home page immediately since the waiting room is meaningless
        // without a lobby to display.

        it('should redirect to home when lobbyId is missing from route', async () => {
            const noIdRoute = { snapshot: { paramMap: { get: () => null } } };
            TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [WaitingRoomComponent],
                providers: [
                    provideRouter([]),
                    { provide: WebSocketService, useValue: createWebSocketMock() },
                    { provide: ChatService, useValue: jasmine.createSpyObj('ChatService', ['requestHistory']) },
                    { provide: GameViewService, useValue: jasmine.createSpyObj('GameViewService', ['setLobby']) },
                    { provide: ActivatedRoute, useValue: noIdRoute },
                ],
            }).compileComponents();

            const localFixture = TestBed.createComponent(WaitingRoomComponent);
            const localRouter = TestBed.inject(Router);
            spyOn(localRouter, 'navigate');
            localFixture.detectChanges();

            expect(localRouter.navigate).toHaveBeenCalledWith(['/home']);
        });

        it('should set lobbyId from route parameter', () => {
            fixture.detectChanges();
            expect(component.lobbyId()).toBe(LOBBY_ID);
        });

        // Edge Case: F5 refresh without sessionStorage flag
        //
        // When a user refreshes the page, sessionStorage won't have the
        // navigation flag. If history.state also has no lobby, the component
        // redirects to home to prevent showing an empty waiting room.

        it('should redirect to home on F5 refresh without session flag and no state', () => {
            spyOn(router, 'navigate');
            fixture.detectChanges();

            expect(router.navigate).toHaveBeenCalled();
        });

        // Edge Case: Lobby data from setupUpdateListeners
        //
        // When the component initializes with proper lobby data,
        // setupUpdateListeners should be callable and register events.

        it('should allow setupUpdateListeners to register all event handlers', () => {
            component.lobbyId.set(LOBBY_ID);
            component.setupUpdateListeners();

            const EXPECTED_LISTENERS = 5;
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENERS);
        });
    });

    // WebSocket Event Listener Tests
    //
    // These tests verify that setupUpdateListeners registers handlers for
    // all five critical events. Each handler either updates component state
    // or triggers navigation.

    describe('setupUpdateListeners', () => {
        beforeEach(() => {
            component.setupUpdateListeners();
        });

        const EXPECTED_LISTENER_COUNT = 5;

        it(`should register ${EXPECTED_LISTENER_COUNT} WebSocket event listeners`, () => {
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });

        // Parameterized listener registration tests
        //
        // Each event listener must be registered with the correct namespace
        // and event name. We verify all five in a single parameterized block.

        const expectedEvents = [
            JoinGameEvents.LobbyUpdated,
            JoinGameEvents.LobbyStatusReceived,
            JoinGameEvents.GameStarting,
            JoinGameEvents.PlayerKicked,
            JoinGameEvents.GameDeleted,
        ];

        expectedEvents.forEach((event) => {
            it(`should register listener for ${event}`, () => {
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    event,
                    jasmine.any(Function),
                );
            });
        });

        it('should update currentLobby when LobbyUpdated event is received', (done) => {
            const updatedLobby = createMockLobby({ playerCount: 3 });

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.LobbyUpdated);
                callback?.(updatedLobby);

                expect(component.currentLobby()).toEqual(updatedLobby);
                done();
            }, randomNetworkLatency());
        });

        it('should update currentLobby and request chat history on LobbyStatusReceived', (done) => {
            const statusLobby = createMockLobby();

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.LobbyStatusReceived);
                callback?.(statusLobby);

                expect(component.currentLobby()).toEqual(statusLobby);
                expect(chatService.requestHistory).toHaveBeenCalledWith(LOBBY_ID);
                done();
            }, randomNetworkLatency());
        });

        it('should set lobby in gameViewService and navigate to game on GameStarting', (done) => {
            const finalLobby = createMockLobby();
            spyOn(router, 'navigate');

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.GameStarting);
                callback?.(finalLobby);

                expect(gameViewService.setLobby).toHaveBeenCalledWith(finalLobby);
                expect(router.navigate).toHaveBeenCalledWith(['/game', LOBBY_ID]);
                done();
            }, randomNetworkLatency());
        });

        it('should navigate to home when PlayerKicked event is received', (done) => {
            spyOn(router, 'navigate');

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.PlayerKicked);
                callback?.('Vous avez été exclu.');

                expect(router.navigate).toHaveBeenCalledWith(['/home']);
                done();
            }, randomNetworkLatency());
        });

        it('should navigate to home when GameDeleted event is received', (done) => {
            spyOn(router, 'navigate');

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.GameDeleted);
                callback?.();

                expect(router.navigate).toHaveBeenCalledWith(['/home']);
                done();
            }, randomNetworkLatency());
        });
    });
});
