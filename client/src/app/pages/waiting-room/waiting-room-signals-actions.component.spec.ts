/**
 * Test suite for the WaitingRoomComponent (Part 2: Computed Signals, Host Actions & Cleanup).
 * This continuation of the test suite validates the complex reactive state and permissions of the waiting room.
 * It thoroughly tests computed signals (current player identification, organizer privileges, game start validation) under both optimal conditions and edge cases like missing lobby data.
 * Furthermore, it verifies that host-exclusive actions (kicking players, starting the match, locking the room) are strictly protected against unauthorized access by standard players.
 * Finally, the suite ensures robust component teardown by confirming all WebSocket listeners and session storage keys are properly cleaned up upon destruction.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { ChatService } from '@app/services/chat/chat.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { WaitingRoomComponent } from './waiting-room.component';

const MIN_PLAYERS_TO_START = 2;

describe('WaitingRoomComponent - Signals, Actions & Cleanup', () => {
    let component: WaitingRoomComponent;
    let fixture: ComponentFixture<WaitingRoomComponent>;
    let webSocketService: jasmine.SpyObj<WebSocketService>;

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
        fixture = TestBed.createComponent(WaitingRoomComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    describe('computed signals', () => {
        describe('currentPlayer', () => {
            /** Gracefully handles initialization states by returning undefined if the lobby data has not yet been fetched from the server. */
            it('should return undefined when lobby is not set', () => {
                expect(component.currentPlayer()).toBeUndefined();
            });

            /** Successfully isolates and identifies the local player object by matching the underlying socket ID with the roster. */
            it('should return the current player based on socket ID', () => {
                component.currentLobby.set(createMockLobby());
                const player = component.currentPlayer();
                expect(player?.socketId).toBe(HOST_SOCKET_ID);
            });

            /** Protects against runtime errors by safely returning undefined if the player's socket unexpectedly goes missing from the lobby roster, such as immediately after being kicked. */
            it('should return undefined when socket ID is not in players list', () => {
                webSocketService.getSocketId.and.returnValue('unknown-socket');
                component.currentLobby.set(createMockLobby());
                expect(component.currentPlayer()).toBeUndefined();
            });
        });

        describe('isOrganizer', () => {
            /** Accurately grants organizational UI privileges when the local player's socket matches the designated host ID in the lobby state. */
            it('should return true when current player is the host', () => {
                component.currentLobby.set(createMockLobby());
                expect(component.isOrganizer()).toBeTrue();
            });

            /** Strictly denies organizational privileges to standard connected players to secure administrative actions like kicking or locking the room. */
            it('should return false when current player is not the host', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());
                expect(component.isOrganizer()).toBeFalse();
            });

            /** Resolves to a true fallback safely when the lobby is undefined during initialization, relying on secondary guards to prevent premature administrative actions. */
            it('should return true when lobby is not set due to undefined equality', () => {
                expect(component.isOrganizer()).toBeTrue();
            });
        });

        describe('canStartGame', () => {
            /** Authorizes the game start sequence strictly when the requesting player is the host and the lobby meets the minimum capacity threshold. */
            it('should return true when organizer and enough players', () => {
                component.currentLobby.set(createMockLobby({ playerCount: MIN_PLAYERS_TO_START }));
                expect(component.canStartGame()).toBeTrue();
            });

            /** Enforces the minimum player constraints to prevent the host from launching a solitary, invalid game session. */
            it('should return false when only 1 player in lobby', () => {
                component.currentLobby.set(createMockLobby({ playerCount: 1 }));
                expect(component.canStartGame()).toBeFalse();
            });

            /** Blocks standard players from launching the match even if the lobby is fully populated and ready. */
            it('should return false when not the organizer even with enough players', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby({ playerCount: MIN_PLAYERS_TO_START }));
                expect(component.canStartGame()).toBeFalse();
            });

            /** Acts as a strict initialization guard, defaulting the start capability to false before the lobby state is resolved. */
            it('should return false when lobby is undefined', () => {
                expect(component.canStartGame()).toBeFalse();
            });
        });

        describe('players', () => {
            /** Defaults to an empty rendering array to prevent template errors if the lobby state is currently unavailable. */
            it('should return empty array when lobby is not set', () => {
                expect(component.players()).toEqual([]);
            });

            /** Manipulates the player list order to ensure the session host is visually prioritized at the very top of the UI roster. */
            it('should return organizer first in the list', () => {
                component.currentLobby.set(createMockLobby());
                const playerList = component.players();
                expect(playerList[0].isHost).toBeTrue();
                expect(playerList[0].socketId).toBe(HOST_SOCKET_ID);
            });

            /** Appends standard participants directly beneath the host in the UI list flow. */
            it('should place non-host players after organizer', () => {
                component.currentLobby.set(createMockLobby());
                const playerList = component.players();
                expect(playerList.length).toBe(2);
                expect(playerList[1].socketId).toBe(PLAYER_SOCKET_ID);
            });
        });
    });

    describe('host actions', () => {
        beforeEach(() => {
            component.currentLobby.set(createMockLobby());
            component.lobbyId.set(LOBBY_ID);
        });

        describe('onKickPlayer', () => {
            /** Allows the recognized organizer to successfully dispatch a socket request to remove a specific opponent from the waiting room. */
            it('should emit KickPlayer event when organizer kicks another player', () => {
                component.onKickPlayer(PLAYER_SOCKET_ID);

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.KickPlayer,
                    { lobbyId: LOBBY_ID, targetSocketId: PLAYER_SOCKET_ID },
                );
            });

            /** Protects the session stability by intercepting and ignoring any accidental requests from the host attempting to kick themselves. */
            it('should not emit KickPlayer when organizer tries to kick themselves', () => {
                component.onKickPlayer(HOST_SOCKET_ID);
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });

            /** Secures the administrative kick feature by strictly ignoring execution attempts originating from standard players. */
            it('should not emit KickPlayer when non-organizer tries to kick', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());

                component.onKickPlayer(HOST_SOCKET_ID);
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        describe('onStartGame', () => {
            /** Transmits the definitive game start command to the server when initiated by the host under valid lobby conditions. */
            it('should emit StartGame event when organizer starts with enough players', () => {
                component.onStartGame();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.StartGame,
                    LOBBY_ID,
                );
            });

            /** Intercepts and blocks the server broadcast if the host clicks the start button before the required player threshold is met. */
            it('should not emit StartGame when not enough players', () => {
                component.currentLobby.set(createMockLobby({ playerCount: 1 }));
                component.onStartGame();
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        describe('onToggleLock', () => {
            /** Allows the host to successfully request the server to lock or unlock the lobby, preventing or allowing new connections. */
            it('should emit ToggleLock event when organizer toggles lock', () => {
                component.onToggleLock();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.ToggleLock,
                    LOBBY_ID,
                );
            });

            /** Secures the lobby state by ignoring unauthorized attempts from standard players to modify the room's lock status. */
            it('should not emit ToggleLock when non-organizer tries', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());

                component.onToggleLock();
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        describe('leaveLobby', () => {
            /** Properly notifies the backend socket architecture when the local player decides to exit the staging area. */
            it('should emit LeaveLobby event', () => {
                component.leaveLobby();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.LeaveLobby,
                );
            });
        });
    });

    describe('ngOnDestroy', () => {
        const EXPECTED_OFF_COUNT = 5;

        beforeEach(() => {
            component.lobbyId.set(LOBBY_ID);
            sessionStorage.setItem('waitingRoom_' + LOBBY_ID, 'true');
        });

        /** Cleans up the local browser session flags to ensure the user does not get incorrectly routed upon returning to the application later. */
        it('should remove sessionStorage key on destroy', () => {
            component.ngOnDestroy();
            expect(sessionStorage.getItem('waitingRoom_' + LOBBY_ID)).toBeNull();
        });

        /** Guarantees a comprehensive teardown of all socket event handlers to secure memory allocation and prevent ghost executions. */
        it(`should call offNamespace ${EXPECTED_OFF_COUNT} times for all listeners`, () => {
            component.ngOnDestroy();
            expect(webSocketService.offNamespace).toHaveBeenCalledTimes(EXPECTED_OFF_COUNT);
        });

        const cleanupEvents = [
            JoinGameEvents.LobbyUpdated,
            JoinGameEvents.LobbyStatusReceived,
            JoinGameEvents.GameStarting,
            JoinGameEvents.PlayerKicked,
            JoinGameEvents.GameDeleted,
        ];

        /** Iterates through the core network events to strictly detach each listener, preventing stale callbacks after the component has unmounted. */
        cleanupEvents.forEach((event) => {
            it(`should unsubscribe from ${event}`, () => {
                component.ngOnDestroy();
                expect(webSocketService.offNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    event,
                );
            });
        });
    });
});