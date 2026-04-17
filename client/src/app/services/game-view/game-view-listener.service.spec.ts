import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { GameLogicService } from '@app/services/game-view/game-logic.service';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { GameViewListenerService } from '@app/services/game-view/game-view-listener.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';

import { Lobby } from '@common/lobby';

const FIVE_SECONDS = 5;
const TEN_SECONDS = 10;

describe('GameViewListenerService', () => {
    let service: GameViewListenerService;
    let wsSpy: jasmine.SpyObj<WebSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let gvSpy: jasmine.SpyObj<GameViewService>;
    let gcSpy: jasmine.SpyObj<GameViewCombatService>;
    let glSpy: jasmine.SpyObj<GameLogicService>;
    const listeners: Map<string, (data: unknown) => void> = new Map();

    const mockLobby = { lobbyId: 'L1', game: { grid: [] }, players: [] };

    const callListener = (event: string, data?: unknown) => {
        const cb = listeners.get(event);
        if (cb) cb(data);
    };

    beforeEach(() => {
        wsSpy = jasmine.createSpyObj('WebSocketService', ['onNamespace']);
        wsSpy.onNamespace.and.callFake((ns, ev, cb) => {
            if (ns === SocketNamespace.Join) listeners.set(ev, cb);
        });
        
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        const mockSignal = (val: unknown) => {
            const s = jasmine.createSpy('signal').and.returnValue(val);
            (s as unknown as { set: jasmine.Spy }).set = jasmine.createSpy('set');
            (s as unknown as { update: jasmine.Spy }).update = jasmine.createSpy('update');
            return s;
        };

        gvSpy = jasmine.createSpyObj('GameViewService', [
            'setLobby', 'resetGameState', 'showFirstTurnNotification', 'showNextTurnNotification',
            'closePromptIfOpen', 'getLocalSocketId', 'isDebugModeActive', 'promptFlagTransfer', 'handleGameOverEvent',
        ], {
            combatLockState: mockSignal(null),
            turnOrder: mockSignal([]),
            playerPositions: mockSignal({}),
            playerStartPositions: mockSignal({}),
            activePlayerSocketId: mockSignal(null),
            turnNotification: mockSignal(null),
            turnCountdownMax: mockSignal(0),
            disableEndTurn: mockSignal(false),
            turnCountdown: mockSignal(0),
            reachableTiles: mockSignal([]),
            reachableTilesForTeleport: mockSignal([]),
            movementPoints: mockSignal(0),
            actionPoints: mockSignal(0),
            isFlagTaken: mockSignal(false),
            gameLobby: mockSignal(null),
            inactiveSanctuaries: mockSignal([]),
            journalEntries: mockSignal([]),
            tileInfo: mockSignal(null),
        }) as jasmine.SpyObj<GameViewService>;

        gcSpy = jasmine.createSpyObj('GameViewCombatService', ['setupListeners']);
        glSpy = jasmine.createSpyObj('GameLogicService', [
            'applyFlagPickup', 'removePlayerFromLobby', 'toggleDoor', 'expandSanctuaryPositions', 'updatePlayerStats',
        ]);

        TestBed.configureTestingModule({
            providers: [
                GameViewListenerService,
                { provide: WebSocketService, useValue: wsSpy },
                { provide: Router, useValue: routerSpy },
                { provide: GameViewService, useValue: gvSpy },
                { provide: GameViewCombatService, useValue: gcSpy },
                { provide: GameLogicService, useValue: glSpy },
            ],
        });
        service = TestBed.inject(GameViewListenerService);
        listeners.clear();
    });

    it('should register all listeners and setup combat listeners', () => {
        service.registerListeners();
        expect(wsSpy.onNamespace).toHaveBeenCalled();
        expect(gcSpy.setupListeners).toHaveBeenCalled();
        
        // Prevent double registration
        const count = wsSpy.onNamespace.calls.count();
        service.registerListeners();
        expect(wsSpy.onNamespace.calls.count()).toEqual(count);
    });

    it('should handle basic game flow events', () => {
        service.registerListeners();

        callListener(JoinGameEvents.LeftLobby, {});
        expect(routerSpy.navigate).toHaveBeenCalledWith([ROUTES.home]);

        callListener(JoinGameEvents.GameStarted, { lobby: mockLobby, turnOrder: [], playerPositions: {}, playerStartPositions: {} });
        expect(gvSpy.resetGameState).toHaveBeenCalled();
        expect(gvSpy.setLobby).toHaveBeenCalledWith(mockLobby as unknown as Lobby);

        callListener(JoinGameEvents.TurnStarted, 'p1');
        expect(gvSpy.activePlayerSocketId.set).toHaveBeenCalledWith('p1');
    });

    it('should handle countdown events', () => {
        service.registerListeners();
        (gvSpy.turnCountdownMax as unknown as jasmine.Spy).and.returnValue(0);

        callListener(JoinGameEvents.BetweenTurnCountdown, FIVE_SECONDS);
        expect(gvSpy.disableEndTurn.set).toHaveBeenCalledWith(true);
        expect(gvSpy.turnCountdown.set).toHaveBeenCalledWith(FIVE_SECONDS);

        callListener(JoinGameEvents.TurnCountdown, TEN_SECONDS);
        expect(gvSpy.turnCountdown.set).toHaveBeenCalledWith(TEN_SECONDS);
    });

    it('should handle movement and flag events', () => {
        service.registerListeners();
        gvSpy.getLocalSocketId.and.returnValue('p1');

        callListener(JoinGameEvents.PlayerMoved, { socketId: 'p1', position: { x: 1, y: 1 }, movementPoints: 2, flagTaken: true });
        expect(gvSpy.movementPoints.set).toHaveBeenCalledWith(2);
        expect(gvSpy.isFlagTaken.set).toHaveBeenCalledWith(true);

        callListener(JoinGameEvents.FlagTransferred, { giverPlayerId: 'p1', targetPlayerId: 'p2' });
        expect(gvSpy.gameLobby.update).toHaveBeenCalled();
    });

    it('should handle abandonment and game over', () => {
        service.registerListeners();
        callListener(JoinGameEvents.PlayerAbandoned, { socketId: 'p1', updatedLobby: mockLobby });
        expect(gvSpy.playerPositions.update).toHaveBeenCalled();

        callListener(JoinGameEvents.GameOver, { winnerSocketId: 'p1' });
        expect(gvSpy.handleGameOverEvent).toHaveBeenCalled();
    });

    it('should handle sanctuary and stats updates', () => {
        service.registerListeners();
        glSpy.expandSanctuaryPositions.and.returnValue([]);
        callListener(JoinGameEvents.SanctuaryUsed, { playerName: 'Bob', healAmount: 1, inactiveSanctuaries: [] });
        expect(gvSpy.inactiveSanctuaries.set).toHaveBeenCalled();

        callListener(JoinGameEvents.PlayerStatsUpdate, { socketId: 'p1', attack: 5, defense: 5, life: 5 });
        expect(gvSpy.gameLobby.update).toHaveBeenCalled();
    });

});
