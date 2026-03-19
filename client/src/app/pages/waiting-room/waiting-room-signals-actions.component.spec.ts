/**
 * WaitingRoomComponent Test Suite (Signals, Actions & Cleanup)
 *
 * Testing Strategy:
 * This second file covers the reactive state and permission logic in the waiting room.
 * We test three things:
 *
 * 1. Computed Signals - The component derives several values from the lobby state:
 *    who the current player is, whether they're the host, whether the game can start,
 *    and the sorted player list. We test each signal with valid data and edge cases
 *    like missing lobby or unknown socket IDs.
 *
 * 2. Host Actions - Only the host can kick players, start the game, or toggle the lock.
 *    We verify these actions emit the right socket events when the host calls them,
 *    and that they're silently blocked when a regular player tries.
 *
 * 3. Cleanup - On destroy, the component removes all 5 socket listeners and clears
 *    its session storage key. We check both to prevent memory leaks and stale state.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ChatService } from '@app/services/chat/chat.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { WaitingRoomComponent } from './waiting-room.component';

const MIN_PLAYERS_TO_START = 2;
const FULL_LOBBY_SIZE = 4;

@Component({ template: '', standalone: true })
class DummyRouteComponent {}

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
                provideRouter([{ path: 'home', component: DummyRouteComponent }]),
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


    // Computed Signals
    //
    // These signals derive from the lobby state and the current socket ID
    // They drive the template: who am I, am I the host, can I start the game, etc

    describe('computed signals', () => {
        describe('currentPlayer', () => {
            // No lobby loaded yet - should return undefined
            it('should return undefined when lobby is not set', () => {
                expect(component.currentPlayer()).toBeUndefined();
            });

            // Find ourselves in the player list by matching socket ID
            it('should return the current player based on socket ID', () => {
                component.currentLobby.set(createMockLobby());
                const player = component.currentPlayer();
                expect(player?.socketId).toBe(HOST_SOCKET_ID);
            });

            // If our socket ID isn't in the list (like after  getting kicked), return undefined
            it('should return undefined when socket ID is not in players list', () => {
                webSocketService.getSocketId.and.returnValue('unknown-socket');
                component.currentLobby.set(createMockLobby());
                expect(component.currentPlayer()).toBeUndefined();
            });
        });

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

            // Before the lobby loads, this defaults to true
            // (this should never happen and other guards prevent it)
            it('should return true when lobby is not set due to undefined equality', () => {
                expect(component.isOrganizer()).toBeTrue();
            });
        });

        describe('canStartGame', () => {
            it('should return true when organizer and enough players', () => {
                component.currentLobby.set(createMockLobby({ playerCount: MIN_PLAYERS_TO_START }));
                expect(component.canStartGame()).toBeTrue();
            });

            // Can't start a game alone
            it('should return false when only 1 player in lobby', () => {
                component.currentLobby.set(createMockLobby({ playerCount: 1 }));
                expect(component.canStartGame()).toBeFalse();
            });

            // Even with enough players, only the host can start
            it('should return false when not the organizer even with enough players', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby({ playerCount: MIN_PLAYERS_TO_START }));
                expect(component.canStartGame()).toBeFalse();
            });

            it('should return false when lobby is undefined', () => {
                expect(component.canStartGame()).toBeFalse();
            });
        });

        describe('players', () => {
            it('should return empty array when lobby is not set', () => {
                expect(component.players()).toEqual([]);
            });

            // The host should always appear first in the player list
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

            // Lobby with maximum players (4 players)
            // Verifies that the sorting logic works with max players
            // host always remains first regardless of the order players joined
            it('should still place host first in a full 4-player lobby', () => {
                const fullLobby = createMockLobby({
                    playerCount: 4,
                    players: [
                        createMockPlayer({ socketId: 'p3', isHost: false }),
                        createMockPlayer({ socketId: HOST_SOCKET_ID, isHost: true }),
                        createMockPlayer({ socketId: 'p4', isHost: false }),
                        createMockPlayer({ socketId: PLAYER_SOCKET_ID, isHost: false }),
                    ],
                });
                fullLobby.hostSocketId = HOST_SOCKET_ID;
                component.currentLobby.set(fullLobby);

                const playerList = component.players();
                expect(playerList[0].socketId).toBe(HOST_SOCKET_ID);
                expect(playerList.length).toBe(FULL_LOBBY_SIZE);
            });
        });
    });


    // Host Actions
    //
    // These are host-only operations. Regular players trying to call them
    // should result in nothing being emitted

    describe('host actions', () => {
        beforeEach(() => {
            component.currentLobby.set(createMockLobby());
            component.lobbyId.set(LOBBY_ID);
        });

        describe('onKickPlayer', () => {
            it('should emit KickPlayer event when organizer kicks another player', () => {
                component.onKickPlayer(PLAYER_SOCKET_ID);

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.KickPlayer,
                    { lobbyId: LOBBY_ID, targetSocketId: PLAYER_SOCKET_ID },
                );
            });

            // Host shouldn't be able to kick themselves
            it('should not emit KickPlayer when organizer tries to kick themselves', () => {
                component.onKickPlayer(HOST_SOCKET_ID);
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });

            // Regular players can't kick anyone
            it('should not emit KickPlayer when non-organizer tries to kick', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());

                component.onKickPlayer(HOST_SOCKET_ID);
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        describe('onStartGame', () => {
            it('should emit StartGame event when organizer starts with enough players', () => {
                component.onStartGame();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.StartGame,
                    LOBBY_ID,
                );
            });

            // Not enough players - no request should be sent
            it('should not emit StartGame when not enough players', () => {
                component.currentLobby.set(createMockLobby({ playerCount: 1 }));
                component.onStartGame();
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        describe('onToggleLock', () => {
            it('should emit ToggleLock event when organizer toggles lock', () => {
                component.onToggleLock();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.ToggleLock,
                    LOBBY_ID,
                );
            });

            it('should not emit ToggleLock when non-organizer tries', () => {
                webSocketService.getSocketId.and.returnValue(PLAYER_SOCKET_ID);
                component.currentLobby.set(createMockLobby());

                component.onToggleLock();
                expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
            });
        });

        describe('leaveLobby', () => {
            it('should emit LeaveLobby event', () => {
                component.leaveLobby();

                expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                    SocketNamespace.Join,
                    JoinGameEvents.LeaveLobby,
                );
            });
        });

        // Multiple rapid action calls should not emit duplicates
        // Why: A user might double-click "Start" before the UI updates. The second
        // call should still emit because the component doesn't debounce - but both
        // emissions should have the correct response
        describe('rapid action calls', () => {
            it('should handle two consecutive startGame calls without error', () => {
                component.onStartGame();
                component.onStartGame();
                expect(webSocketService.emitNamespace).toHaveBeenCalledTimes(2);
            });
        });
    });


    // Cleanup
    //
    // On destroy we need to unregister all 5 listeners and clear the session
    // storage flag so the user doesn't get wrongly routed if they come back later.

    describe('ngOnDestroy', () => {
        const EXPECTED_OFF_COUNT = 7;

        beforeEach(() => {
            component.lobbyId.set(LOBBY_ID);
            sessionStorage.setItem('waitingRoom_' + LOBBY_ID, 'true');
        });

        it('should remove sessionStorage key on destroy', () => {
            component.ngOnDestroy();
            expect(sessionStorage.getItem('waitingRoom_' + LOBBY_ID)).toBeNull();
        });

        // Same number of off calls as on calls - no listeners left
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
            JoinGameEvents.PlayerJoined,
            JoinGameEvents.PlayerLeft,
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
