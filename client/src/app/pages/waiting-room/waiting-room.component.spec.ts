/**
 * WaitingRoomComponent Test Suite (Initialization and Listeners)
 *
 * Testing Strategy:
 * The waiting room is where players stay before a match starts. This first file
 * covers two things:
 *
 * 1. Initialization Guards - If someone gets on this page without a valid lobby ID
 *    (e.g. direct URL access or F5 refresh), we kick them back to /home. We also
 *    check that the lobbyId is from the route params correctly.
 *
 * 2. WebSocket Listeners - The component registers 5 listeners on init: lobby updates,
 *    status sync, game start, player kicked, and game deleted. We simulate each event
 *    through captured callbacks and verify the component reacts properly (updating state,
 *    navigating away, fetching chat history, etc.).
 *
 * WebSocket Mocking Strategy:
 * We capture every callback passed to onNamespace in a Map keyed by event name. This lets
 * us fire events manually with test data
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ChatService } from '@app/services/chat/chat.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { WaitingRoomComponent } from './waiting-room.component';

@Component({ template: '', standalone: true })
class DummyRouteComponent {}

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
        combatCount: 0,
        lossCount: 0,
        totalHpLost: 0,
        totalHpDealt: 0,
        visitedTilesCount: 0,
        hasFlag: false,
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
        teamA: [],
        teamB: [],
        ...overrides,
    });

    const capturedCallbacks = new Map<string, (...args: unknown[]) => void>();
    const createWebSocketMock = () => {
        const mock = jasmine.createSpyObj('WebSocketService', [
            'onNamespace', 'offNamespace', 'offMultiple', 'emitNamespace', 'getSocketId',
        ]);
        mock.onNamespace.and.callFake(
            (_namespace: string, event: string, callback: (...args: unknown[]) => void) => {
                capturedCallbacks.set(event, callback);
            },
        );
        mock.offMultiple.and.callFake((namespace: string, events: string[]) => {
            events.forEach((e: string) => mock.offNamespace(namespace, e));
        });
        mock.getSocketId.and.returnValue(HOST_SOCKET_ID);
        return mock;
    };

    beforeEach(async () => {
        capturedCallbacks.clear();
        const webSocketMock = createWebSocketMock();
        const chatMock = jasmine.createSpyObj('ChatService', ['requestHistory', 'roomMessages$', 'sendMessage']);
        chatMock['roomMessages$'].and.returnValue({ subscribe: () => ({ unsubscribe: () => undefined }) });
        const gameViewMock = jasmine.createSpyObj('GameViewService', ['setLobby']);

        await TestBed.configureTestingModule({
            imports: [WaitingRoomComponent],
            providers: [
                provideRouter([
                    { path: 'home', component: DummyRouteComponent },
                    { path: 'game/:id', component: DummyRouteComponent },
                ]),
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


    // Initialization
    //
    // The component needs a valid lobbyId from the route to work. If it's missing
    // (direct URL access) or state got deleted (F5 refresh), we redirect to /home.

    describe('ngOnInit', () => {
        // No lobbyId in the route means the user navigated here directly - send them home
        it('should redirect to home when lobbyId is missing from route', async () => {
            const noIdRoute = { snapshot: { paramMap: { get: () => null } } };
            TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [WaitingRoomComponent],
                providers: [
                    provideRouter([{ path: 'home', component: DummyRouteComponent }]),
                    { provide: WebSocketService, useValue: createWebSocketMock() },
                    { provide: ChatService, useValue: (() => {
                        const m = jasmine.createSpyObj('ChatService', ['requestHistory', 'roomMessages$', 'sendMessage']);
                        m['roomMessages$'].and.returnValue({ subscribe: () => ({ unsubscribe: () => undefined }) });
                        return m;
                    })() },
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

        // F5 refresh clears session storage and router state, so we can't recover - go home
        it('should redirect to home on F5 refresh without session flag and no state', () => {
            spyOn(router, 'navigate');
            fixture.detectChanges();

            expect(router.navigate).toHaveBeenCalled();
        });

        it('should allow setupUpdateListeners to register all event handlers', () => {
            component.lobbyId.set(LOBBY_ID);
            component['setupUpdateListeners']();

            const EXPECTED_LISTENERS = 7;
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(EXPECTED_LISTENERS);
        });
    });


    // WebSocket Event Listeners
    //
    // The component listens for 5 events: lobby updates, initial status sync,
    // game starting, player kicked, and game deleted. Each one triggers different
    // behavior - updating state, navigating, or fetching chat history.

    describe('setupUpdateListeners', () => {
        beforeEach(() => {
            component['setupUpdateListeners']();
        });

        const EXPECTED_LISTENER_COUNT = 7;

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

        // Make sure each event is registered on the Join namespace
        expectedEvents.forEach((event) => {
            it(`should register listener for ${event}`, () => {
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    event,
                    jasmine.any(Function),
                );
            });
        });

        // When a player joins or leaves, the server sends an updated lobby object
        it('should update currentLobby when LobbyUpdated event is received', () => {
            const updatedLobby = createMockLobby({ playerCount: 3 });

            const callback = capturedCallbacks.get(JoinGameEvents.LobbyUpdated);
            callback?.(updatedLobby);

            expect(component.currentLobby()).toEqual(updatedLobby);
        });

        // Initial sync - we get the lobby state and also fetch existing chat messages
        it('should update currentLobby and request chat history on LobbyStatusReceived', () => {
            const statusLobby = createMockLobby();

            const callback = capturedCallbacks.get(JoinGameEvents.LobbyStatusReceived);
            callback?.(statusLobby);

            expect(component.currentLobby()).toEqual(statusLobby);
            expect(chatService.requestHistory).toHaveBeenCalledWith(LOBBY_ID);
        });

        // Game is starting - save the lobby in gameViewService and navigate to the game page
        it('should set lobby in gameViewService and navigate to game on GameStarting', () => {
            const finalLobby = createMockLobby();
            spyOn(router, 'navigate');

            const callback = capturedCallbacks.get(JoinGameEvents.GameStarting);
            callback?.(finalLobby);

            expect(gameViewService.setLobby).toHaveBeenCalledWith(finalLobby);
            expect(router.navigate).toHaveBeenCalledWith(['/game', LOBBY_ID]);
        });

        // Got kicked by the host - back to home
        it('should navigate to home when PlayerKicked event is received', () => {
            spyOn(router, 'navigate');

            const callback = capturedCallbacks.get(JoinGameEvents.PlayerKicked);
            callback?.('Vous avez été exclu.');

            expect(router.navigate).toHaveBeenCalledWith(['/home']);
        });

        // Host deleted the game - everyone goes home
        it('should navigate to home when GameDeleted event is received', () => {
            spyOn(router, 'navigate');

            const callback = capturedCallbacks.get(JoinGameEvents.GameDeleted);
            callback?.();

            expect(router.navigate).toHaveBeenCalledWith(['/home']);
        });
    });
});
