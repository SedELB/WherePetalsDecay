/**
 * Test suite for the GameViewService.
 * This service acts as the central state manager for the active game view, listening to numerous WebSocket events.
 * The tests heavily utilize a callback-capture pattern for the WebSocketService, allowing manual simulation of server events.
 * It thoroughly validates how local state updates in response to both local player actions and opponent actions.
 */

import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace, TileTexture } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { GameViewService, GameStartedData, TileInfoData } from './game-view.service';

describe('GameViewService', () => {
    let service: GameViewService;
    let webSocketService: jasmine.SpyObj<WebSocketService>;
    let router: Router;

    const LOCAL_SOCKET_ID = 'local-socket';
    const OTHER_SOCKET_ID = 'other-socket';
    
    const COUNTDOWN_TIME = 25;
    const SPAWN_X = 4;
    const SPAWN_Y = 4;
    const COMBAT_DAMAGE = 6;
    const MP_USED = 3;
    const MP_LEFT = 4;
    const DEFAULT_COUNTDOWN = 15;
    const DEFAULT_MP = 5;

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
        mock.getSocketId.and.returnValue(LOCAL_SOCKET_ID);
        return mock;
    };

    const createMockPlayer = (socketId: string, overrides: Partial<Player> = {}): Player => ({
        socketId,
        isHost: false,
        winsCount: 0,
        hasAbandonned: false,
        character: {
            name: `Player-${socketId}`, avatar: 'avatar.png', life: 6, speed: 4,
            attack: 4, defense: 4, lifeBonus: false, attackDice: 'D6', defenseDice: 'D4',
        },
        ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'lobby-1', gameId: 'game-1', hostSocketId: LOCAL_SOCKET_ID,
        playerCount: 2, isLocked: true,
        players: [createMockPlayer(LOCAL_SOCKET_ID, { isHost: true }), createMockPlayer(OTHER_SOCKET_ID)],
        game: {
            _id: 'game-1', name: 'Test Game', description: '', size: { rows: 10, cols: 10 },
            gameMode: GameMode.Classic, thumbnail: '', maxPlayers: 4, grid: [],
            isVisible: true, createdAt: new Date(), updatedAt: new Date(),
        },
        pendingAvatars: {}, chatHistory: [], ...overrides,
    });

    beforeEach(() => {
        capturedCallbacks.clear();
        TestBed.configureTestingModule({
            providers: [GameViewService, provideRouter([]), { provide: WebSocketService, useValue: createWebSocketMock() }],
        });
        webSocketService = TestBed.inject(WebSocketService) as jasmine.SpyObj<WebSocketService>;
        router = TestBed.inject(Router);
        service = TestBed.inject(GameViewService);
    });

    /** Ensures the service successfully instantiates without throwing any dependency injection errors. */
    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('WebSocket listener registration', () => {
        const expectedEvents = [
            JoinGameEvents.LeftLobby, JoinGameEvents.GameStarted, JoinGameEvents.TurnStarted,
            JoinGameEvents.TurnCountdown, JoinGameEvents.TurnEnded, JoinGameEvents.PlayerMoved,
            JoinGameEvents.ReachableTiles, JoinGameEvents.MovementPoints, JoinGameEvents.CombatResult,
            JoinGameEvents.PlayerAbandoned, JoinGameEvents.GameOver, JoinGameEvents.TileInfo,
        ];

        /** Iterates through all core game events to guarantee the service registers a listener for each one upon initialization. */
        expectedEvents.forEach((event) => {
            it(`should register a listener for ${event}`, () => {
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Join, event, jasmine.any(Function));
            });
        });

        /** Verifies that no extraneous or missing socket listeners are attached to the namespace. */
        it(`should register exactly ${expectedEvents.length} listeners`, () => {
            expect(webSocketService.onNamespace).toHaveBeenCalledTimes(expectedEvents.length);
        });
    });

    describe('GameStarted event', () => {
        /** Validates that the service correctly unpacks and applies the initial board state when a match begins. */
        it('should populate lobby, turn order, and positions', () => {
            const lobby = createMockLobby();
            const data: GameStartedData = {
                lobby, turnOrder: [LOCAL_SOCKET_ID, OTHER_SOCKET_ID],
                playerPositions: { [LOCAL_SOCKET_ID]: { x: 0, y: 0 }, [OTHER_SOCKET_ID]: { x: SPAWN_X, y: SPAWN_Y } },
            };
            capturedCallbacks.get(JoinGameEvents.GameStarted)?.(data);
            expect(service.gameLobby()).toEqual(lobby);
            expect(service.turnOrder()).toEqual([LOCAL_SOCKET_ID, OTHER_SOCKET_ID]);
            expect(service.playerPositions()).toEqual(data.playerPositions);
        });

        /** Ensures that starting a new game cleanly wipes out any leftover UI states from a previous match. */
        it('should wipe leftover gameOver from a previous match', () => {
            service.gameOver.set({ winnerSocketId: 'old', isForfeit: false });
            capturedCallbacks.get(JoinGameEvents.GameStarted)?.({ lobby: createMockLobby(), turnOrder: [], playerPositions: {} });
            expect(service.gameOver()).toBeNull();
        });
    });

    describe('TurnStarted event', () => {
        /** Confirms the service dynamically updates the active player signal to reflect the server's current turn order. */
        it('should set the active player', () => {
            capturedCallbacks.get(JoinGameEvents.TurnStarted)?.(LOCAL_SOCKET_ID);
            expect(service.activePlayerSocketId()).toBe(LOCAL_SOCKET_ID);
        });
    });

    describe('TurnCountdown event', () => {
        /** Synchronizes the local timer signal with the exact seconds remaining as broadcasted by the server. */
        it('should store the seconds left', () => {
            capturedCallbacks.get(JoinGameEvents.TurnCountdown)?.(COUNTDOWN_TIME);
            expect(service.turnCountdown()).toBe(COUNTDOWN_TIME);
        });
    });

    describe('TurnEnded event', () => {
        /** Ensures the game view properly clears out active states during the transition between turns. */
        it('should go back to idle state (no active player, no reachable tiles)', () => {
            service.activePlayerSocketId.set(LOCAL_SOCKET_ID);
            service.reachableTiles.set([{ x: 1, y: 1 }]);
            capturedCallbacks.get(JoinGameEvents.TurnEnded)?.();
            expect(service.activePlayerSocketId()).toBeNull();
            expect(service.reachableTiles()).toEqual([]);
        });
    });

    describe('PlayerMoved event', () => {
        /** Updates the internal coordinate tracking specifically for the player who executed the movement. */
        it('should update position for the player who moved', () => {
            service.playerPositions.set({ [LOCAL_SOCKET_ID]: { x: 0, y: 0 } });
            capturedCallbacks.get(JoinGameEvents.PlayerMoved)?.({ 
                socketId: LOCAL_SOCKET_ID, position: { x: 1, y: 0 }, movementPoints: MP_USED, 
            });
            expect(service.playerPositions()[LOCAL_SOCKET_ID]).toEqual({ x: 1, y: 0 });
        });

        /** Adjusts the local UI movement point counter strictly when the local player completes a valid move. */
        it('should update local MP when the local player moves', () => {
            capturedCallbacks.get(JoinGameEvents.PlayerMoved)?.({ 
                socketId: LOCAL_SOCKET_ID, position: { x: 1, y: 0 }, movementPoints: 2, 
            });
            expect(service.movementPoints()).toBe(2);
        });

        /** Protects the local player's UI from incorrectly displaying an opponent's movement points when the opponent moves. */
        it('should leave local MP untouched when someone else moves', () => {
            service.movementPoints.set(MP_LEFT);
            capturedCallbacks.get(JoinGameEvents.PlayerMoved)?.({ 
                socketId: OTHER_SOCKET_ID, position: { x: 3, y: 3 }, movementPoints: 1, 
            });
            expect(service.movementPoints()).toBe(MP_LEFT);
        });
    });

    describe('ReachableTiles event', () => {
        /** Updates the visual movement preview overlay specifically when the server calculates valid paths for the local player. */
        it('should update the preview overlay for the local player', () => {
            const tiles = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
            capturedCallbacks.get(JoinGameEvents.ReachableTiles)?.({ socketId: LOCAL_SOCKET_ID, tiles });
            expect(service.reachableTiles()).toEqual(tiles);
        });

        /** Ignores incoming pathfinding data that belongs to opponents to prevent rendering their potential moves on the local screen. */
        it('should ignore tiles meant for another player', () => {
            service.reachableTiles.set([{ x: 9, y: 9 }]);
            capturedCallbacks.get(JoinGameEvents.ReachableTiles)?.({ socketId: OTHER_SOCKET_ID, tiles: [{ x: 0, y: 0 }] });
            expect(service.reachableTiles()).toEqual([{ x: 9, y: 9 }]);
        });
    });

    describe('MovementPoints event', () => {
        /** Keeps the local player's movement points perfectly synced with the server's authoritative calculations. */
        it('should update MP for the local player', () => {
            capturedCallbacks.get(JoinGameEvents.MovementPoints)?.({ socketId: LOCAL_SOCKET_ID, movementPoints: COMBAT_DAMAGE });
            expect(service.movementPoints()).toBe(COMBAT_DAMAGE);
        });

        /** Safely ignores movement point broadcasts belonging to opponents. */
        it('should ignore MP for other players', () => {
            service.movementPoints.set(MP_USED);
            capturedCallbacks.get(JoinGameEvents.MovementPoints)?.({ socketId: OTHER_SOCKET_ID, movementPoints: COMBAT_DAMAGE });
            expect(service.movementPoints()).toBe(MP_USED);
        });
    });

    describe('CombatResult event', () => {
        beforeEach(() => {
            service.setLobby(createMockLobby());
            service.playerPositions.set({ [LOCAL_SOCKET_ID]: { x: 2, y: 2 }, [OTHER_SOCKET_ID]: { x: 3, y: 2 } });
        });

        /** Modifies the lobby data in-place to accurately increment the victory tracker for the player who won the engagement. */
        it('should bump the winner winsCount', () => {
            capturedCallbacks.get(JoinGameEvents.CombatResult)?.({ 
                winnerId: LOCAL_SOCKET_ID, loserId: OTHER_SOCKET_ID, 
                damage: COMBAT_DAMAGE, loserHpLeft: COMBAT_DAMAGE, killed: true, loserNewPosition: { x: 0, y: 0 }, 
            });
            const winner = service.gameLobby()?.players.find((p) => p.socketId === LOCAL_SOCKET_ID);
            expect(winner?.winsCount).toBe(1);
        });

        /** Handles the death penalty by instantly updating the defeated player's coordinates to their designated spawn point. */
        it('should teleport the loser to their new spawn', () => {
            capturedCallbacks.get(JoinGameEvents.CombatResult)?.({ 
                winnerId: LOCAL_SOCKET_ID, loserId: OTHER_SOCKET_ID, damage: COMBAT_DAMAGE, 
                loserHpLeft: COMBAT_DAMAGE, killed: true, loserNewPosition: { x: SPAWN_X, y: SPAWN_Y }, 
            });
            expect(service.playerPositions()[OTHER_SOCKET_ID]).toEqual({ x: SPAWN_X, y: SPAWN_Y });
        });

        /** Gracefully handles rare edge cases where the server cannot provide a valid spawn point, leaving the player at their current position. */
        it('should not move the loser if the server sends null position', () => {
            capturedCallbacks.get(JoinGameEvents.CombatResult)?.({ 
                winnerId: LOCAL_SOCKET_ID, loserId: OTHER_SOCKET_ID, damage: COMBAT_DAMAGE, 
                loserHpLeft: COMBAT_DAMAGE, killed: true, loserNewPosition: null, 
            });
            expect(service.playerPositions()[OTHER_SOCKET_ID]).toEqual({ x: 3, y: 2 });
        });
    });

    describe('PlayerAbandoned event', () => {
        beforeEach(() => {
            service.setLobby(createMockLobby());
            service.playerPositions.set({ [LOCAL_SOCKET_ID]: { x: 0, y: 0 }, [OTHER_SOCKET_ID]: { x: SPAWN_X, y: SPAWN_Y } });
        });

        /** Instantly purges the abandoning player from the local coordinate tracking to remove their avatar from the game board. */
        it('should remove the quitter from positions', () => {
            capturedCallbacks.get(JoinGameEvents.PlayerAbandoned)?.({ socketId: OTHER_SOCKET_ID, updatedLobby: createMockLobby({ playerCount: 1 }) });
            expect(service.playerPositions()[OTHER_SOCKET_ID]).toBeUndefined();
        });

        /** Swaps out the old lobby data with the fresh, server-provided lobby payload to accurately reflect the new player count and roster. */
        it('should swap in the updated lobby from the server', () => {
            capturedCallbacks.get(JoinGameEvents.PlayerAbandoned)?.({ socketId: OTHER_SOCKET_ID, updatedLobby: createMockLobby({ playerCount: 1 }) });
            expect(service.gameLobby()?.playerCount).toBe(1);
        });
    });

    describe('GameOver event', () => {
        /** Correctly captures and stores the winning player's information to trigger the end-of-game victory overlay. */
        it('should store the winner info', () => {
            capturedCallbacks.get(JoinGameEvents.GameOver)?.({ winnerSocketId: LOCAL_SOCKET_ID, isForfeit: false });
            expect(service.gameOver()).toEqual({ winnerSocketId: LOCAL_SOCKET_ID, isForfeit: false });
        });

        /** Identifies scenarios where a player wins by default because all other competitors abandoned the match. */
        it('should handle forfeit wins (everyone else quit)', () => {
            capturedCallbacks.get(JoinGameEvents.GameOver)?.({ winnerSocketId: LOCAL_SOCKET_ID, isForfeit: true });
            expect(service.gameOver()?.isForfeit).toBe(true);
        });

        /** Properly processes a mutual draw or total abandonment scenario where the server declares no distinct winner. */
        it('should handle a draw / no-winner scenario', () => {
            capturedCallbacks.get(JoinGameEvents.GameOver)?.({ winnerSocketId: null, isForfeit: true });
            expect(service.gameOver()?.winnerSocketId).toBeNull();
        });
    });

    describe('TileInfo event', () => {
        /** Saves the detailed contextual information about a specific tile so the UI can display it in a popup. */
        it('should store tile info including player on it', () => {
            const info: TileInfoData = { 
                tile: { type: TileTexture.Floor, item: null },
                cost: 1, 
                player: { name: 'Bob', avatar: 'a.png' }, 
            };
            capturedCallbacks.get(JoinGameEvents.TileInfo)?.(info);
            expect(service.tileInfo()).toEqual(info);
        });

        /** Verifies that the service safely processes tile data even when the designated space is completely unoccupied. */
        it('should handle empty tiles (no player standing there)', () => {
            const info: TileInfoData = { tile: { type: TileTexture.Water, item: null }, cost: 2, player: null };
            capturedCallbacks.get(JoinGameEvents.TileInfo)?.(info);
            expect(service.tileInfo()?.player).toBeNull();
        });
    });

    describe('LeftLobby event', () => {
        /** Wipes the internal lobby state clean and forces a navigation event back to the homepage when the session is closed or left. */
        it('should clear the lobby and redirect home', () => {
            spyOn(router, 'navigate');
            service.setLobby(createMockLobby());
            capturedCallbacks.get(JoinGameEvents.LeftLobby)?.();
            expect(service.gameLobby()).toBeNull();
            expect(router.navigate).toHaveBeenCalledWith(['/home']);
        });
    });

    describe('emit methods', () => {
        const LOBBY_ID = 'lobby-1';

        /** Confirms the movement request payload is structured correctly before being dispatched over the socket. */
        it('should emit RequestMove', () => {
            service.sendMove(LOBBY_ID, 'W');
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestMove, { lobbyId: LOBBY_ID, direction: 'W' },
            );
        });

        /** Verifies the end-turn signal is sent directly with the lobby identifier. */
        it('should emit EndTurn', () => {
            service.sendEndTurn(LOBBY_ID);
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(SocketNamespace.Join, JoinGameEvents.EndTurn, LOBBY_ID);
        });

        /** Ensures the abandonment signal is properly transmitted to notify the server of the player's departure. */
        it('should emit PlayerAbandon', () => {
            service.sendAbandon(LOBBY_ID);
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(SocketNamespace.Join, JoinGameEvents.PlayerAbandon, LOBBY_ID);
        });

        /** Checks that the combat request accurately bundles both the local lobby context and the targeted opponent's socket ID. */
        it('should emit RequestCombat', () => {
            service.sendCombat(LOBBY_ID, OTHER_SOCKET_ID);
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestCombat, { lobbyId: LOBBY_ID, targetSocketId: OTHER_SOCKET_ID },
            );
        });

        /** Validates the format of the payload dispatched when requesting detailed environmental data for a specific board coordinate. */
        it('should emit RequestTileInfo', () => {
            service.sendTileInfoRequest(LOBBY_ID, { x: 3, y: 5 });
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestTileInfo, { lobbyId: LOBBY_ID, position: { x: 3, y: 5 } },
            );
        });
    });

    describe('resetGameState', () => {
        /** Purges all reactive signals back to their default, empty states to prevent data leakage between different game sessions. */
        it('should bring every signal back to defaults', () => {
            service.gameOver.set({ winnerSocketId: 'x', isForfeit: false });
            service.activePlayerSocketId.set('x');
            service.turnCountdown.set(DEFAULT_COUNTDOWN);
            service.reachableTiles.set([{ x: 1, y: 1 }]);
            service.movementPoints.set(DEFAULT_MP);
            service.tileInfo.set({ tile: { type: TileTexture.Floor, item: null }, cost: 1, player: null });
            service.playerPositions.set({ x: { x: 0, y: 0 } });
            service.turnOrder.set(['x']);

            service['resetGameState']();

            expect(service.gameOver()).toBeNull();
            expect(service.activePlayerSocketId()).toBeNull();
            expect(service.turnCountdown()).toBe(0);
            expect(service.reachableTiles()).toEqual([]);
            expect(service.movementPoints()).toBe(0);
            expect(service.tileInfo()).toBeNull();
            expect(service.playerPositions()).toEqual({});
            expect(service.turnOrder()).toEqual([]);
        });
    });

    describe('setLobby', () => {
        /** Saves the provided lobby configuration into the primary reactive signal. */
        it('should store the lobby', () => {
            service.setLobby(createMockLobby());
            expect(service.gameLobby()).toBeTruthy();
        });

        /** Allows dependent components to manually wipe the lobby state by passing a null value. */
        it('should accept null to clear it', () => {
            service.setLobby(createMockLobby());
            service.setLobby(null);
            expect(service.gameLobby()).toBeNull();
        });
    });

    describe('getLocalSocketId', () => {
        /** Serves as a reliable proxy to fetch the current active connection ID from the underlying WebSocket service. */
        it('should delegate to WebSocketService', () => {
            expect(service.getLocalSocketId()).toBe(LOCAL_SOCKET_ID);
        });
    });
});