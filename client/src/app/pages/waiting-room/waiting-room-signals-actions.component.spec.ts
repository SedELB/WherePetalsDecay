/**
 * WaitingRoomComponent Test Suite — Part 2: Computed Signals, Host Actions & Cleanup
 *
 * This file continues the WaitingRoomComponent tests and covers:
 *
 * 1. Computed Signals - Tests the four computed signals (currentPlayer, isOrganizer,
 *    canStartGame, players) which derive UI state from the currentLobby signal. Each
 *    computed is tested for its normal case and edge cases (empty lobby, missing player).
 *
 * 2. Host Actions - Tests organizer-only actions: kickPlayer, startGame, toggleLock.
 *    Verifies that non-organizers cannot trigger these actions and that the correct
 *    WebSocket events are emitted with proper payloads.
 *
 * 3. Cleanup - Verifies ngOnDestroy removes sessionStorage keys and unsubscribes
 *    from all five WebSocket listeners to prevent memory leaks.
 *
 * WebSocket Mocking Strategy:
 * We mock WebSocketService with jasmine spies that use callFake to capture event
 * callbacks by event name. The getSocketId spy returns a fixed socket ID to enable
 * computed signal testing.
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
        fixture = TestBed.createComponent(WaitingRoomComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    // Computed Signal Tests
    //
    // The waiting room uses four computed signals that derive UI state from
    // currentLobby. Each computed must handle undefined lobby gracefully.

    describe('computed signals', () => {
        // currentPlayer Tests
        //
        // currentPlayer finds the player in the lobby whose socketId matches
        // the WebSocket service's socket ID. Returns undefined if no match.

        describe('currentPlayer', () => {
            it('should return undefined when lobby is not set', () => {
                expect(component.currentPlayer()).toBeUndefined();
            });

            it('should return the current player based on socket ID', () => {
                component.currentLobby.set(createMockLobby());
                const player = component.currentPlayer();
                expect(player?.socketId).toBe(HOST_SOCKET_ID);
            });

            // Edge Case: Socket ID not found in players list
            //
            // Can happen if the player was kicked but the component hasn't
            // navigated away yet.

            it('should return undefined when socket ID is not in players list', () => {
                webSocketService.getSocketId.and.returnValue('unknown-socket');
                component.currentLobby.set(createMockLobby());
                expect(component.currentPlayer()).toBeUndefined();
            });
        });

        // isOrganizer Tests
        //
        // isOrganizer checks if currentPlayer's socketId matches the lobby's
        // hostSocketId. Only the organizer can kick, lock, and start the game.

        describe('isOrganizer', () => {
            it('should return true when current player is the host', () => {
                component.currentLobby.set(createMockLobby());
                expect(component.isOrganizer()).toBeTrue();
            });

            it('should return false when current player is not the host', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());
                expect(component.isOrganizer()).toBeFalse();
            });

            // Edge Case: Lobby not loaded yet
            //
            // When lobby is undefined, both hostSocketId and currentPlayer socketId
            // are undefined, so undefined === undefined evaluates to true. This is
            // safe because canStartGame still returns false (playerCount is 0).

            it('should return true when lobby is not set due to undefined equality', () => {
                expect(component.isOrganizer()).toBeTrue();
            });
        });

        // canStartGame Tests
        //
        // Game can only start when the current player is the organizer AND
        // there are at least 2 players in the lobby.

        describe('canStartGame', () => {
            it('should return true when organizer and enough players', () => {
                component.currentLobby.set(createMockLobby({ playerCount: MIN_PLAYERS_TO_START }));
                expect(component.canStartGame()).toBeTrue();
            });

            // Edge Case: Only 1 player (host alone)
            //
            // A game cannot start with fewer than 2 players, even if
            // the host wants to start.

            it('should return false when only 1 player in lobby', () => {
                component.currentLobby.set(createMockLobby({ playerCount: 1 }));
                expect(component.canStartGame()).toBeFalse();
            });

            it('should return false when not the organizer even with enough players', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby({ playerCount: MIN_PLAYERS_TO_START }));
                expect(component.canStartGame()).toBeFalse();
            });

            // Edge Case: Lobby undefined
            //
            // Before lobby data loads, canStartGame must be false.

            it('should return false when lobby is undefined', () => {
                expect(component.canStartGame()).toBeFalse();
            });
        });

        // players Tests
        //
        // Returns the player list with the organizer always first.
        // This ensures the host is visually distinguished at the top.

        describe('players', () => {
            it('should return empty array when lobby is not set', () => {
                expect(component.players()).toEqual([]);
            });

            it('should return organizer first in the list', () => {
                component.currentLobby.set(createMockLobby());
                const playerList = component.players();
                expect(playerList[0].isHost).toBeTrue();
                expect(playerList[0].socketId).toBe(HOST_SOCKET_ID);
            });

            it('should place non-host players after organizer', () => {
                component.currentLobby.set(createMockLobby());
                const playerList = component.players();
                expect(playerList.length).toBe(2);
                expect(playerList[1].socketId).toBe(PLAYER_SOCKET_ID);
            });
        });
    });

    // Host Action Tests
    //
    // These tests verify the three organizer-only actions: kick, start, lock.
    // Each action emits a WebSocket event only when the caller is authorized.

    describe('host actions', () => {
        beforeEach(() => {
            component.currentLobby.set(createMockLobby());
            component.lobbyId.set(LOBBY_ID);
        });

        // onKickPlayer Tests
        //
        // Only the organizer can kick players, and they cannot kick themselves.

        describe('onKickPlayer', () => {
            it('should emit KickPlayer event when organizer kicks another player', () => {
                component.onKickPlayer(PLAYER_SOCKET_ID);

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.KickPlayer,
                    { lobbyId: LOBBY_ID, targetSocketId: PLAYER_SOCKET_ID },
                );
            });

            // Edge Case: Organizer tries to kick themselves
            //
            // The onKickPlayer method checks targetSocketId !== currentPlayer.socketId
            // so the host cannot remove themselves.

            it('should not emit KickPlayer when organizer tries to kick themselves', () => {
                component.onKickPlayer(HOST_SOCKET_ID);
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });

            // Edge Case: Non-organizer tries to kick
            //
            // Regular players should not be able to kick anyone.

            it('should not emit KickPlayer when non-organizer tries to kick', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());

                component.onKickPlayer(HOST_SOCKET_ID);
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        // onStartGame Tests

        describe('onStartGame', () => {
            it('should emit StartGame event when organizer starts with enough players', () => {
                component.onStartGame();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.StartGame,
                    LOBBY_ID,
                );
            });

            // Edge Case: Not enough players to start
            //
            // canStartGame returns false with < 2 players, so onStartGame
            // should not emit the event.

            it('should not emit StartGame when not enough players', () => {
                component.currentLobby.set(createMockLobby({ playerCount: 1 }));
                component.onStartGame();
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        // onToggleLock Tests

        describe('onToggleLock', () => {
            it('should emit ToggleLock event when organizer toggles lock', () => {
                component.onToggleLock();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.ToggleLock,
                    LOBBY_ID,
                );
            });

            // Edge Case: Non-organizer tries to toggle lock
            //
            // Only the host should be able to lock/unlock the lobby.

            it('should not emit ToggleLock when non-organizer tries', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());

                component.onToggleLock();
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        // leaveLobby Tests

        describe('leaveLobby', () => {
            it('should emit LeaveLobby event', () => {
                component.leaveLobby();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.LeaveLobby,
                );
            });
        });
    });

    // Cleanup Tests
    //
    // ngOnDestroy must clean up sessionStorage and unsubscribe from all
    // five WebSocket listeners to prevent memory leaks.

    describe('ngOnDestroy', () => {
        const EXPECTED_OFF_COUNT = 5;

        beforeEach(() => {
            component.lobbyId.set(LOBBY_ID);
            sessionStorage.setItem('waitingRoom_' + LOBBY_ID, 'true');
        });

        it('should remove sessionStorage key on destroy', () => {
            component.ngOnDestroy();
            expect(sessionStorage.getItem('waitingRoom_' + LOBBY_ID)).toBeNull();
        });

        it(`should call offNamespace ${EXPECTED_OFF_COUNT} times for all listeners`, () => {
            component.ngOnDestroy();
            expect(webSocketService.offNamespace).toHaveBeenCalledTimes(EXPECTED_OFF_COUNT);
        });

        // Parameterized cleanup verification
        //
        // Each of the five events must be unsubscribed to prevent stale
        // handlers from firing after navigation away.

        const cleanupEvents = [
            JoinGameEvents.LobbyUpdated,
            JoinGameEvents.LobbyStatusReceived,
            JoinGameEvents.GameStarting,
            JoinGameEvents.PlayerKicked,
            JoinGameEvents.GameDeleted,
        ];

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
