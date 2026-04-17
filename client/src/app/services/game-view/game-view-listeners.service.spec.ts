import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { GameViewListenersService } from '@app/services/game-view/game-view-listeners.service';
import { GameViewSignals } from '@app/services/game-view/game-view-signals.interface';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace, TileTexture } from '@common/enums';
import { CombatLockStateData, GameStartedData } from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';

// Constants
const LOBBY_ID = 'lobby-1';
const LOCAL_SOCKET = 'local-socket';
const OTHER_SOCKET = 'other-socket';
const MOVEMENT_POINTS = 3;
const ACTION_POINTS = 1;
const HEAL_AMOUNT = 2;
const NEW_LIFE = 4;
const COUNTDOWN_VALUE = 5;

// Helpers

const makeMockSignal = <T>(initial: T) => {
    const setSpy = jasmine.createSpy('set');
    const updateSpy = jasmine.createSpy('update');
    const callSpy = jasmine.createSpy('call').and.returnValue(initial);
    const signal = callSpy as unknown as jasmine.Spy & {
        set: jasmine.Spy;
        update: jasmine.Spy;
    };
    signal.set = setSpy;
    signal.update = updateSpy;
    return signal;
};

const buildMockLobby = (): Lobby => ({
    lobbyId: LOBBY_ID,
    gameId: 'game-1',
    hostSocketId: LOCAL_SOCKET,
    playerCount: 2,
    isLocked: true,
    players: [
        {
            socketId: LOCAL_SOCKET,
            isHost: true,
            winsCount: 0,
            hasAbandonned: false,
            playerType: 'real' as Lobby['players'][number]['playerType'],
            hasFlag: false,
            combatCount: 0,
            lossCount: 0,
            totalHpLost: 0,
            totalHpDealt: 0,
            visitedTilesCount: 0,
            character: {
                name: 'Local', avatar: '', life: 6, speed: 4, attack: 4, defense: 4, lifeBonus: false,
                attackDice: 'D6' as Lobby['players'][number]['character']['attackDice'],
                defenseDice: 'D4' as Lobby['players'][number]['character']['defenseDice'],
            },
        },
    ],
    game: {
        _id: 'game-1', name: '', description: '',
        size: { rows: 2, cols: 2 },
        gameMode: 'classic' as Lobby['game']['gameMode'],
        thumbnail: '', maxPlayers: 4, grid: [], isVisible: true, createdAt: new Date(), updatedAt: new Date(),
    },
    pendingAvatars: {},
    chatHistory: [],
    teamA: [],
    teamB: [],
});

describe('GameViewListenersService', () => {
    let service: GameViewListenersService;
    let wsSpy: jasmine.SpyObj<WebSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let combatSpy: jasmine.SpyObj<GameViewCombatService>;
    let signals: GameViewSignals & { [key: string]: unknown };

    const listeners = new Map<string, (data: unknown) => void>();

    const callListener = (event: string, data?: unknown): void => {
        const cb = listeners.get(event);
        if (cb) cb(data);
    };

    beforeEach(() => {
        listeners.clear();

        wsSpy = jasmine.createSpyObj('WebSocketService', ['onNamespace']);
        wsSpy.onNamespace.and.callFake(<T>(ns: SocketNamespace, ev: string, cb: (data: T) => void) => {
            if (ns === SocketNamespace.Join) listeners.set(ev, cb as (data: unknown) => void);
        });

        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        combatSpy = jasmine.createSpyObj('GameViewCombatService', ['setupListeners']);

        signals = jasmine.createSpyObj('GameViewSignals', [
            'setLobby', 'resetGameState', 'showFirstTurnNotification', 'showNextTurnNotification',
            'handleGameOverEvent', 'closeFlagTransferSwalIfOpen', 'promptFlagTransfer',
            'expandSanctuaryPositions', 'triggerDoorAnimation', 'getLocalSocketId',
        ]) as unknown as GameViewSignals & { [key: string]: unknown };

        signals['namespace'] = SocketNamespace.Join;
        signals['isDebugModeActive'] = makeMockSignal(false) as unknown as GameViewSignals['isDebugModeActive'];
        signals['disableEndTurn'] = makeMockSignal(false) as unknown as GameViewSignals['disableEndTurn'];
        signals['gameLobby'] = makeMockSignal(null) as unknown as GameViewSignals['gameLobby'];
        signals['playerPositions'] = makeMockSignal({}) as unknown as GameViewSignals['playerPositions'];
        signals['playerStartPositions'] = makeMockSignal({}) as unknown as GameViewSignals['playerStartPositions'];
        signals['turnOrder'] = makeMockSignal([]) as unknown as GameViewSignals['turnOrder'];
        signals['activePlayerSocketId'] = makeMockSignal(null) as unknown as GameViewSignals['activePlayerSocketId'];
        signals['turnCountdown'] = makeMockSignal(0) as unknown as GameViewSignals['turnCountdown'];
        signals['reachableTiles'] = makeMockSignal([]) as unknown as GameViewSignals['reachableTiles'];
        signals['reachableTilesForTeleport'] = makeMockSignal([]) as unknown as GameViewSignals['reachableTilesForTeleport'];
        signals['movementPoints'] = makeMockSignal(0) as unknown as GameViewSignals['movementPoints'];
        signals['actionPoints'] = makeMockSignal(0) as unknown as GameViewSignals['actionPoints'];
        signals['tileInfo'] = makeMockSignal(null) as unknown as GameViewSignals['tileInfo'];
        signals['turnNotification'] = makeMockSignal(null) as unknown as GameViewSignals['turnNotification'];
        signals['inactiveSanctuaries'] = makeMockSignal([]) as unknown as GameViewSignals['inactiveSanctuaries'];
        signals['journalEntries'] = makeMockSignal([]) as unknown as GameViewSignals['journalEntries'];
        signals['isFlagTaken'] = makeMockSignal(false) as unknown as GameViewSignals['isFlagTaken'];
        signals['combatLockState'] = makeMockSignal(null) as unknown as GameViewSignals['combatLockState'];

        (signals.getLocalSocketId as jasmine.Spy).and.returnValue(LOCAL_SOCKET);
        (signals.expandSanctuaryPositions as jasmine.Spy).and.returnValue([]);

        TestBed.configureTestingModule({
            providers: [
                GameViewListenersService,
                { provide: WebSocketService, useValue: wsSpy },
                { provide: Router, useValue: routerSpy },
                { provide: GameViewCombatService, useValue: combatSpy },
            ],
        });

        service = TestBed.inject(GameViewListenersService);
        service.registerAll(signals as unknown as GameViewSignals);
    });

    /** Verifies the service can be instantiated without errors. */
    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    /** Confirms all event types are registered by checking that onNamespace was called multiple times. */
    it('should register listeners for all game events', () => {
        expect(wsSpy.onNamespace).toHaveBeenCalled();
        expect(combatSpy.setupListeners).toHaveBeenCalled();
    });

    // Lifecycle listeners

    describe('LeftLobby', () => {
        /** Clears the lobby state and navigates to home when the server confirms the player has left. */
        it('should clear the lobby and navigate home on LeftLobby', () => {
            callListener(JoinGameEvents.LeftLobby);
            expect(signals.setLobby).toHaveBeenCalledWith(null);
            expect((signals.combatLockState as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(null);
            expect(routerSpy.navigate).toHaveBeenCalledWith([ROUTES.home]);
        });
    });

    describe('GameStarted', () => {
        /** Resets state and populates all game-start signals when the server fires GameStarted. */
        it('should reset state and initialise all game signals on GameStarted', () => {
            const lobby = buildMockLobby();
            const data: GameStartedData = {
                lobby,
                turnOrder: [LOCAL_SOCKET],
                playerPositions: { [LOCAL_SOCKET]: { x: 0, y: 0 } },
                playerStartPositions: { [LOCAL_SOCKET]: { x: 0, y: 0 } },
            };
            callListener(JoinGameEvents.GameStarted, data);
            expect(signals.resetGameState).toHaveBeenCalled();
            expect(signals.setLobby).toHaveBeenCalledWith(lobby);
            expect((signals.turnOrder as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith([LOCAL_SOCKET]);
        });
    });

    describe('PlayerAbandoned', () => {
        /** Removes the abandoned player from the positions map and updates the lobby reference. */
        it('should remove the abandoned player position and update lobby', () => {
            const lobby = buildMockLobby();
            callListener(JoinGameEvents.PlayerAbandoned, { socketId: OTHER_SOCKET, updatedLobby: lobby });
            expect((signals.playerPositions as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
            expect(signals.setLobby).toHaveBeenCalledWith(lobby);
        });
    });

    describe('GameOver', () => {
        /** Delegates the game-over payload to the signals handler for further processing. */
        it('should call handleGameOverEvent on GameOver', () => {
            const data = { winnerSocketId: OTHER_SOCKET };
            callListener(JoinGameEvents.GameOver, data);
            expect(signals.handleGameOverEvent).toHaveBeenCalledWith(data);
        });
    });

    // Turn listeners

    describe('TurnStarted', () => {
        /** Sets the active player socket and clears the turn notification when a new turn begins. */
        it('should set active player and clear notification on TurnStarted', () => {
            callListener(JoinGameEvents.TurnStarted, LOCAL_SOCKET);
            expect((signals.activePlayerSocketId as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(LOCAL_SOCKET);
            expect((signals.turnNotification as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(null);
        });
    });

    describe('BetweenTurnCountdown', () => {
        /** Disables the end-turn button and updates the countdown during the between-turn phase. */
        it('should disable end turn and set countdown on BetweenTurnCountdown', () => {
            callListener(JoinGameEvents.BetweenTurnCountdown, COUNTDOWN_VALUE);
            expect((signals.disableEndTurn as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(true);
            expect((signals.turnCountdown as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(COUNTDOWN_VALUE);
        });
    });

    describe('TurnEnded', () => {
        /** Clears the active player and reachable tiles when a turn ends. */
        it('should clear active player and reachable tiles on TurnEnded', () => {
            callListener(JoinGameEvents.TurnEnded, LOCAL_SOCKET);
            expect((signals.activePlayerSocketId as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(null);
            expect((signals.reachableTiles as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith([]);
            expect(signals.showNextTurnNotification).toHaveBeenCalledWith(LOCAL_SOCKET);
        });
    });

    // Movement listeners

    describe('PlayerMoved', () => {
        /** Updates the player position and sets movement points for the local player on PlayerMoved. */
        it('should update player position and movement points for the local player', () => {
            callListener(JoinGameEvents.PlayerMoved, {
                socketId: LOCAL_SOCKET, position: { x: 1, y: 1 }, movementPoints: MOVEMENT_POINTS,
            });
            expect((signals.playerPositions as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
            expect((signals.movementPoints as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(MOVEMENT_POINTS);
        });

        /** Does not update movement points for a different player's movement event. */
        it('should not update movement points for other players', () => {
            callListener(JoinGameEvents.PlayerMoved, {
                socketId: OTHER_SOCKET, position: { x: 2, y: 2 }, movementPoints: MOVEMENT_POINTS,
            });
            expect((signals.movementPoints as unknown as { set: jasmine.Spy }).set).not.toHaveBeenCalled();
        });

        /** Applies flag pickup when the PlayerMoved event indicates a flag was taken. */
        it('should apply flag pickup when flagTaken is true', () => {
            callListener(JoinGameEvents.PlayerMoved, {
                socketId: LOCAL_SOCKET, position: { x: 1, y: 1 }, movementPoints: MOVEMENT_POINTS, flagTaken: true,
            });
            expect((signals.isFlagTaken as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(true);
        });
    });

    describe('ActionPoints', () => {
        /** Sets action points only when the event is addressed to the local socket. */
        it('should set action points for the local player', () => {
            callListener(JoinGameEvents.ActionPoints, { socketId: LOCAL_SOCKET, actionPoints: ACTION_POINTS });
            expect((signals.actionPoints as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(ACTION_POINTS);
        });

        /** Ignores action-point updates addressed to other players. */
        it('should not set action points for other players', () => {
            callListener(JoinGameEvents.ActionPoints, { socketId: OTHER_SOCKET, actionPoints: ACTION_POINTS });
            expect((signals.actionPoints as unknown as { set: jasmine.Spy }).set).not.toHaveBeenCalled();
        });
    });

    describe('ReachableTiles', () => {
        /** Sets the reachable-tiles list only for the local socket. */
        it('should set reachable tiles for the local player', () => {
            const tiles = [{ x: 1, y: 0 }];
            callListener(JoinGameEvents.ReachableTiles, { socketId: LOCAL_SOCKET, tiles });
            expect((signals.reachableTiles as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(tiles);
        });
    });

    // Flag listeners

    describe('FlagTransferred', () => {
        /** Updates hasFlag for both the giver and the receiver on a flag transfer event. */
        it('should update hasFlag for giver and receiver', () => {
            callListener(JoinGameEvents.FlagTransferred, { giverPlayerId: LOCAL_SOCKET, targetPlayerId: OTHER_SOCKET });
            expect((signals.gameLobby as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
        });
    });

    describe('GiveFlagResponse', () => {
        /** Prompts the user with a flag transfer dialogue when receiving a GiveFlagResponse event. */
        it('should call promptFlagTransfer on GiveFlagResponse', () => {
            callListener(JoinGameEvents.GiveFlagResponse, {
                requesterId: OTHER_SOCKET, requesterName: 'Bob', lobbyId: LOBBY_ID,
            });
            expect(signals.promptFlagTransfer).toHaveBeenCalledWith(OTHER_SOCKET, 'Bob', LOBBY_ID);
        });
    });

    // Map interaction listeners

    describe('DoorToggled', () => {
        /** Triggers the door animation and updates the grid tile type on DoorToggled. */
        it('should trigger door animation and update grid on DoorToggled', () => {
            callListener(JoinGameEvents.DoorToggled, { position: { x: 1, y: 0 }, newType: TileTexture.DoorOpened });
            expect(signals.triggerDoorAnimation).toHaveBeenCalledWith(1, 0, TileTexture.DoorOpened);
            expect((signals.gameLobby as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
        });
    });

    describe('SanctuaryUsed', () => {
        /** Updates inactive sanctuaries and heals the player when healAmount is positive. */
        it('should update inactive sanctuaries and heal the player', () => {
            callListener(JoinGameEvents.SanctuaryUsed, {
                socketId: LOCAL_SOCKET,
                sanctuaryType: 'healingSanctuary',
                mode: 'normal',
                healAmount: HEAL_AMOUNT,
                combatBonusApplied: false,
                playerNewLife: NEW_LIFE,
                playerName: 'Local',
                inactiveSanctuaries: [],
            });
            expect((signals.inactiveSanctuaries as unknown as { set: jasmine.Spy }).set).toHaveBeenCalled();
            expect((signals.gameLobby as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
        });

        /** Updates inactive sanctuaries only without touching the lobby when healAmount is zero. */
        it('should not update the lobby when healAmount is zero', () => {
            callListener(JoinGameEvents.SanctuaryUsed, {
                socketId: LOCAL_SOCKET,
                sanctuaryType: 'healingSanctuary',
                mode: 'normal',
                healAmount: 0,
                combatBonusApplied: false,
                playerNewLife: NEW_LIFE,
                playerName: 'Local',
                inactiveSanctuaries: [],
            });
            expect((signals.gameLobby as unknown as { update: jasmine.Spy }).update).not.toHaveBeenCalled();
        });
    });

    // Misc listeners

    describe('CombatLockStateChanged', () => {
        /** Sets the combatLockState signal to the received data when the combat is locked. */
        it('should set combatLockState when locked', () => {
            const lockData: CombatLockStateData = {
                lobbyId: LOBBY_ID, isLocked: true, attackerSocketId: LOCAL_SOCKET, defenderSocketId: OTHER_SOCKET,
            };
            callListener(JoinGameEvents.CombatLockStateChanged, lockData);
            expect((signals.combatLockState as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(lockData);
        });

        /** Sets the combatLockState signal to null when the combat lock is released. */
        it('should set combatLockState to null when unlocked', () => {
            const unlockData: CombatLockStateData = { lobbyId: LOBBY_ID, isLocked: false };
            callListener(JoinGameEvents.CombatLockStateChanged, unlockData);
            expect((signals.combatLockState as unknown as { set: jasmine.Spy }).set).toHaveBeenCalledWith(null);
        });
    });

    describe('JournalEntry', () => {
        /** Appends a new journal message to the existing entries list. */
        it('should append the message to journal entries', () => {
            callListener(JoinGameEvents.JournalEntry, 'Alice moved to (2,3)');
            expect((signals.journalEntries as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
        });
    });

    describe('PlayerStatsUpdate', () => {
        /** Updates the matching player character stats within the current lobby. */
        it('should update player stats in the lobby', () => {
            callListener(JoinGameEvents.PlayerStatsUpdate, { socketId: LOCAL_SOCKET, attack: 5, defense: 5, life: 5 });
            expect((signals.gameLobby as unknown as { update: jasmine.Spy }).update).toHaveBeenCalled();
        });
    });
});
