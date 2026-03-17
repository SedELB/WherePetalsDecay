/**
 * Test suite for the WaitingRoomComponent.
 * This component manages the staging area where players gather before a match begins.
 * The tests focus heavily on initialization safety (preventing access without a valid lobby) and real-time synchronization via WebSocket listeners.
 * It ensures the component reacts appropriately to incoming events such as lobby updates, game start signals, or session terminations (kicks/deletions).
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

    const randomNetworkLatency = (): number => {
        return Math.random() * BASE_4500 + BASE_500;
    };

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

    /** Ensures the component successfully instantiates without throwing any errors. */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        /** Protects the application state by forcefully redirecting users to the homepage if they manage to land on the waiting room route without a target lobby ID. */
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

        /** Confirms the component accurately extracts and assigns the requested lobby ID directly from the active route parameters. */
        it('should set lobbyId from route parameter', () => {
            fixture.detectChanges();
            expect(component.lobbyId()).toBe(LOBBY_ID);
        });

        /** Acts as a strict state guard, booting the user back to the homepage if they perform a hard refresh (F5) that clears the necessary session storage and routing state. */
        it('should redirect to home on F5 refresh without session flag and no state', () => {
            spyOn(router, 'navigate');
            fixture.detectChanges();

            expect(router.navigate).toHaveBeenCalled();
        });

        /** Verifies that a properly initialized component immediately proceeds to bind all required real-time event listeners. */
        it('should allow setupUpdateListeners to register all event handlers', () => {
            component.lobbyId.set(LOBBY_ID);
            component.setupUpdateListeners();

            const EXPECTED_LISTENERS = 5;
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENERS);
        });
    });

    describe('setupUpdateListeners', () => {
        beforeEach(() => {
            component.setupUpdateListeners();
        });

        const EXPECTED_LISTENER_COUNT = 5;

        /** Confirms that exactly five specific WebSocket events are actively monitored to keep the waiting room perfectly synchronized with the server. */
        it(`should register ${EXPECTED_LISTENER_COUNT} WebSocket event listeners`, () => {
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENER_COUNT);
        });

        const expectedEvents = [
            JoinGameEvents.LobbyUpdated,
            JoinGameEvents.LobbyStatusReceived,
            JoinGameEvents.GameStarting,
            JoinGameEvents.PlayerKicked,
            JoinGameEvents.GameDeleted,
        ];

        /** Iterates through the core real-time events to guarantee each one is correctly bound to the Join namespace with an executable callback. */
        expectedEvents.forEach((event) => {
            it(`should register listener for ${event}`, () => {
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    event,
                    jasmine.any(Function),
                );
            });
        });

        /** Ensures the local lobby state is dynamically replaced whenever the server broadcasts an update, such as a new player joining the room. */
        it('should update currentLobby when LobbyUpdated event is received', (done) => {
            const updatedLobby = createMockLobby({ playerCount: 3 });

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.LobbyUpdated);
                callback?.(updatedLobby);

                expect(component.currentLobby()).toEqual(updatedLobby);
                done();
            }, randomNetworkLatency());
        });

        /** Verifies that the initial status synchronization both populates the current lobby state and triggers a parallel request to fetch the existing chat history. */
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

        /** Seamlessly transitions the application state to the active game board when the server announces the match is officially beginning. */
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

        /** Gracefully handles a player being forcefully removed by the host, immediately returning them to the homepage to exit the session safely. */
        it('should navigate to home when PlayerKicked event is received', (done) => {
            spyOn(router, 'navigate');

            setTimeout(() => {
                const callback = capturedCallbacks.get(JoinGameEvents.PlayerKicked);
                callback?.('Vous avez été exclu.');

                expect(router.navigate).toHaveBeenCalledWith(['/home']);
                done();
            }, randomNetworkLatency());
        });

        /** Protects the client from remaining in a dead lobby by redirecting them to the homepage if the host decides to delete the session entirely. */
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