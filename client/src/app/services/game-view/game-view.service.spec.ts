import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { DiceType, GameMode, PlayerType, SanctuaryMode, SocketNamespace } from '@common/enums';
import { GameOverEventData } from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';

// Constants
const DEFAULT_LIFE = 6;
const LOCAL_SOCKET = 'local-socket';
const OTHER_SOCKET = 'other-socket';
const LOBBY_ID = 'lobby-1';

// Factories

const buildPlayer = (socketId: string, overrides: Partial<Player> = {}): Player => ({
    socketId,
    isHost: false,
    winsCount: 0,
    hasAbandonned: false,
    playerType: PlayerType.Reel,
    hasFlag: false,
    combatCount: 0,
    lossCount: 0,
    totalHpLost: 0,
    totalHpDealt: 0,
    visitedTilesCount: 0,
    character: {
        name: `Player-${socketId}`,
        avatar: '',
        life: DEFAULT_LIFE,
        speed: 4,
        attack: 4,
        defense: 4,
        lifeBonus: false,
        attackDice: DiceType.D6,
        defenseDice: DiceType.D4,
    },
    ...overrides,
});

const buildLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
    lobbyId: LOBBY_ID,
    gameId: 'game-1',
    hostSocketId: LOCAL_SOCKET,
    playerCount: 2,
    isLocked: true,
    players: [buildPlayer(LOCAL_SOCKET, { isHost: true }), buildPlayer(OTHER_SOCKET)],
    game: {
        _id: 'game-1',
        name: 'Test',
        description: '',
        size: { rows: 3, cols: 3 },
        gameMode: GameMode.Classic,
        thumbnail: '',
        maxPlayers: 4,
        grid: [[{ type: 'floor' as Lobby['game']['grid'][number][number]['type'], item: null }]],
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    pendingAvatars: {},
    chatHistory: [],
    teamA: [],
    teamB: [],
    ...overrides,
});

describe('GameViewService', () => {
    let service: GameViewService;
    let webSocketSpy: jasmine.SpyObj<WebSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let combatServiceSpy: jasmine.SpyObj<GameViewCombatService>;

    beforeEach(() => {
        webSocketSpy = jasmine.createSpyObj<WebSocketService>('WebSocketService', [
            'emitNamespace', 'onNamespace', 'getSocketId',
        ]);
        webSocketSpy.getSocketId.and.returnValue(LOCAL_SOCKET);

        routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

        combatServiceSpy = jasmine.createSpyObj<GameViewCombatService>('GameViewCombatService', [
            'setupListeners', 'resetCombatState', 'sendPostureChoice', 'getCurrentCombatRoomId',
            'completeCombatOverlay',
        ], {
            isCombatStarted: signal(false),
            isRoundTransitioning: signal(false),
            combatRoundIndex: signal(1),
            combatPostureCountdown: signal(0),
            combatPostureCountdownMax: signal(0),
            combatInitiatorName: signal(''),
            combatAttackAnimation: signal(null),
            fighters: signal({ player: {} as Player, enemy: {} as Player, roomId: '' }),
            lastCombatResult: signal(null),
            lastCombatRoundResolved: signal(null),
            combatEndPopup: signal(null),
        });

        TestBed.configureTestingModule({
            providers: [
                GameViewService,
                { provide: WebSocketService, useValue: webSocketSpy },
                { provide: Router, useValue: routerSpy },
                { provide: GameViewCombatService, useValue: combatServiceSpy },
            ],
        });

        service = TestBed.inject(GameViewService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });


    describe('getLocalSocketId', () => {
        /** Delegates to the WebSocketService to retrieve the socket ID for the Join namespace. */
        it('should return the socket ID from WebSocketService', () => {
            expect(service.getLocalSocketId()).toBe(LOCAL_SOCKET);
            expect(webSocketSpy.getSocketId).toHaveBeenCalledWith(SocketNamespace.Join);
        });
    });

    describe('isHost', () => {
        /** Returns true when the local socket ID matches the lobby host socket ID. */
        it('should return true when local player is the lobby host', () => {
            service.setLobby(buildLobby());
            expect(service.isHost()).toBe(true);
        });

        /** Returns false when the local socket ID does not match the lobby host. */
        it('should return false when local player is not the host', () => {
            webSocketSpy.getSocketId.and.returnValue(OTHER_SOCKET);
            service.setLobby(buildLobby());
            expect(service.isHost()).toBe(false);
        });
    });


    describe('setLobby', () => {
        /** Updates the gameLobby signal to the provided lobby object. */
        it('should set the gameLobby signal', () => {
            const lobby = buildLobby();
            service.setLobby(lobby);
            expect(service.gameLobby()).toEqual(lobby);
        });

        /** Clears the gameLobby signal to null when called with null. */
        it('should clear the gameLobby signal when given null', () => {
            service.setLobby(buildLobby());
            service.setLobby(null);
            expect(service.gameLobby()).toBeNull();
        });
    });


    describe('sendMove', () => {
        /** Emits a RequestMove event with the lobby ID and direction to the Join namespace. */
        it('should emit RequestMove with the given direction', () => {
            service.sendMove(LOBBY_ID, 'W');
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestMove,
                jasmine.objectContaining({ lobbyId: LOBBY_ID, direction: 'W' }),
            );
        });
    });


    describe('teleportMove', () => {
        /** Emits a Teleport event with the lobby ID and target position. */
        it('should emit Teleport with position', () => {
            const pos: Vec2 = { x: 3, y: 5 };
            service.teleportMove(LOBBY_ID, pos);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.Teleport,
                jasmine.objectContaining({ lobbyId: LOBBY_ID, position: pos }),
            );
        });
    });


    describe('sendEndTurn', () => {
        /** Emits an EndTurn event for the given lobby ID. */
        it('should emit EndTurn with the lobbyId', () => {
            service.sendEndTurn(LOBBY_ID);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.EndTurn, LOBBY_ID,
            );
        });
    });


    describe('sendAbandon', () => {
        /** Emits a PlayerAbandon event and also disables debug mode when the host abandons during debug. */
        it('should emit PlayerAbandon', () => {
            service.setLobby(buildLobby());
            service.sendAbandon(LOBBY_ID);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.PlayerAbandon, LOBBY_ID,
            );
        });
    });


    describe('sendCombat', () => {
        /** Emits a RequestCombat event with the player and enemy objects. */
        it('should emit RequestCombat with player and enemy', () => {
            const player = buildPlayer(LOCAL_SOCKET);
            const enemy = buildPlayer(OTHER_SOCKET);
            service.sendCombat(LOBBY_ID, player, enemy);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestCombat,
                jasmine.objectContaining({ lobbyId: LOBBY_ID, player, enemy }),
            );
        });
    });


    describe('sendToggleDoor', () => {
        /** Emits a RequestToggleDoor event with the door position. */
        it('should emit RequestToggleDoor with position', () => {
            const pos: Vec2 = { x: 1, y: 2 };
            service.sendToggleDoor(LOBBY_ID, pos);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestToggleDoor,
                jasmine.objectContaining({ lobbyId: LOBBY_ID, position: pos }),
            );
        });
    });


    describe('sendUseSanctuary', () => {
        /** Emits a RequestUseSanctuary event with the position and sanctuary mode. */
        it('should emit RequestUseSanctuary with position and mode', () => {
            const pos: Vec2 = { x: 2, y: 3 };
            service.sendUseSanctuary(LOBBY_ID, pos, SanctuaryMode.Normal);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestUseSanctuary,
                jasmine.objectContaining({ lobbyId: LOBBY_ID, position: pos, mode: SanctuaryMode.Normal }),
            );
        });
    });


    describe('sendTileInfoRequest', () => {
        /** Emits a RequestTileInfo event with the tile coordinates. */
        it('should emit RequestTileInfo with the tile position', () => {
            const pos: Vec2 = { x: 4, y: 6 };
            service.sendTileInfoRequest(LOBBY_ID, pos);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.RequestTileInfo,
                jasmine.objectContaining({ lobbyId: LOBBY_ID, position: pos }),
            );
        });
    });


    describe('applyFlagPickup', () => {
        /** Marks the player as hasFlag and clears the flag tile from the grid. */
        it('should mark the player as hasFlag and clear the grid tile', () => {
            const lobby = buildLobby();
            const tileType = 'floor' as Lobby['game']['grid'][number][number]['type'];
            const tileItem = 'flag' as Lobby['game']['grid'][number][number]['item'];
            lobby.game.grid = [[{ type: tileType, item: tileItem }]];
            service.setLobby(lobby);
            service.applyFlagPickup(LOCAL_SOCKET, { x: 0, y: 0 });
            const updatedLobby = service.gameLobby();
            expect(updatedLobby?.players.find((p) => p.socketId === LOCAL_SOCKET)?.hasFlag).toBe(true);
            expect(service.isFlagTaken()).toBe(true);
        });

        /** Does not crash when the lobby is null at the time of flag pickup. */
        it('should not crash when lobby is null', () => {
            expect(() => service.applyFlagPickup(LOCAL_SOCKET, { x: 0, y: 0 })).not.toThrow();
        });
    });


    describe('syncCombatParticipantLives', () => {
        const SYNCED_LIFE = 3;

        /** Updates the character life of each player whose socket ID appears in the provided map. */
        it('should update player lives from the lifeBySocketId map', () => {
            service.setLobby(buildLobby());
            service.syncCombatParticipantLives({ [LOCAL_SOCKET]: SYNCED_LIFE });
            const player = service.gameLobby()?.players.find((p) => p.socketId === LOCAL_SOCKET);
            expect(player?.character.life).toBe(SYNCED_LIFE);
        });

        /** Does nothing when the provided map is empty, avoiding unnecessary lobby mutations. */
        it('should skip the update when the map is empty', () => {
            service.setLobby(buildLobby());
            service.syncCombatParticipantLives({});
            expect(service.gameLobby()?.players[0].character.life).toBe(DEFAULT_LIFE);
        });

        /** Clamps the synced life value to 0 rather than allowing negative HP. */
        it('should clamp life to 0 when syncedLife is negative', () => {
            service.setLobby(buildLobby());
            service.syncCombatParticipantLives({ [LOCAL_SOCKET]: -5 });
            const player = service.gameLobby()?.players.find((p) => p.socketId === LOCAL_SOCKET);
            expect(player?.character.life).toBe(0);
        });
    });


    describe('resetGameState', () => {
        /** Resets all game-state signals to their default empty/null values, but preserves gameLobby. */
        it('should reset all signals to defaults', () => {
            const TIMER_VALUE = 10;
            const MOVEMENT_VALUE = 5;
            service.setLobby(buildLobby());
            service.activePlayerSocketId.set(LOCAL_SOCKET);
            service.turnCountdown.set(TIMER_VALUE);
            service.movementPoints.set(MOVEMENT_VALUE);
            service.resetGameState();
            expect(service.activePlayerSocketId()).toBeNull();
            expect(service.turnCountdown()).toBe(0);
            expect(service.movementPoints()).toBe(0);
            expect(combatServiceSpy.resetCombatState).toHaveBeenCalled();
        });
    });


    describe('handleGameOverEvent', () => {
        const GAME_OVER_DELAY_MS = 6000;

        /** Sets the gameOver signal and schedules router navigation when a local player is part of the finished game. */
        it('should set gameOver signal and navigate after delay for a local player', (done) => {
            jasmine.clock().install();
            service.setLobby(buildLobby());
            const data: GameOverEventData = {
                winnerSocketId: OTHER_SOCKET,
                players: [buildPlayer(LOCAL_SOCKET)],
            };
            service.handleGameOverEvent(data);
            expect(service.gameOver()).not.toBeNull();
            jasmine.clock().tick(GAME_OVER_DELAY_MS);
            expect(routerSpy.navigate).toHaveBeenCalled();
            jasmine.clock().uninstall();
            done();
        });

        /** Ignores the game-over event when no local player is among the players listed. */
        it('should not set gameOver when local player is not in the players list', () => {
            service.setLobby(buildLobby());
            const data: GameOverEventData = {
                winnerSocketId: OTHER_SOCKET,
                players: [buildPlayer('another-socket')],
            };
            service.handleGameOverEvent(data);
            expect(service.gameOver()).toBeNull();
        });

        /** Routes to home when the game over event is a forfeit. */
        it('should navigate to home when isForfeit is true', (done) => {
            jasmine.clock().install();
            service.setLobby(buildLobby());
            const data: GameOverEventData = {
                winnerSocketId: null,
                isForfeit: true,
                players: [buildPlayer(LOCAL_SOCKET)],
            };
            service.handleGameOverEvent(data);
            jasmine.clock().tick(GAME_OVER_DELAY_MS);
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
            jasmine.clock().uninstall();
            done();
        });
    });


    describe('endGamePlayers and endGameStats', () => {
        /** Returns an empty player array before any game-over event has been processed. */
        it('should return empty players before a game-over event', () => {
            expect(service.endGamePlayers()).toEqual([]);
        });

        /** Returns null stats before any game-over event has been processed. */
        it('should return null stats before a game-over event', () => {
            expect(service.endGameStats()).toBeNull();
        });
    });


    describe('showNextTurnNotification', () => {
        /** Sets the turn notification message when a valid next player exists in the turn order. */
        it('should set the turnNotification signal', () => {
            service.setLobby(buildLobby());
            service.turnOrder.set([LOCAL_SOCKET, OTHER_SOCKET]);
            service.showNextTurnNotification(LOCAL_SOCKET);
            expect(service.turnNotification()).not.toBeNull();
        });
    });


    describe('showFirstTurnNotification', () => {
        /** Sets the turn notification for the very first turn of the game session. */
        it('should set the first-turn notification when the lobby has players', () => {
            const lobby = buildLobby();
            service.showFirstTurnNotification([LOCAL_SOCKET, OTHER_SOCKET], lobby);
            expect(service.turnNotification()).not.toBeNull();
        });
    });
});
