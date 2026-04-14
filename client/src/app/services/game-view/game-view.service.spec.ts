import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameViewCombatService } from './game-view-combat.service';
import { GameViewListenersService } from './game-view-listeners.service';
import { GameViewService } from './game-view.service';

describe('GameViewService', () => {
    let service: GameViewService;

    beforeEach(() => {
        const webSocketSpy = jasmine.createSpyObj('WebSocketService', ['emitNamespace', 'onNamespace', 'getSocketId']);
        const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        const combatServiceSpy = jasmine.createSpyObj('GameViewCombatService', ['setupListeners', 'resetCombatState', 'sendPostureChoice',
            'getCurrentCombatRoomId'], {
            isCombatStarted: jasmine.createSpy().and.returnValue(false),
            combatRoundIndex: jasmine.createSpy().and.returnValue(0),
            combatPostureCountdown: jasmine.createSpy().and.returnValue(0),
            combatAttackAnimation: jasmine.createSpy().and.returnValue(null),
            fighters: jasmine.createSpy().and.returnValue({ player: {}, enemy: {}, roomId: '' }),
            lastCombatResult: jasmine.createSpy().and.returnValue(null),
        });
        const listenersServiceSpy = jasmine.createSpyObj('GameViewListenersService', ['registerAll']);

        TestBed.configureTestingModule({
            providers: [
                GameViewService,
                { provide: WebSocketService, useValue: webSocketSpy },
                { provide: Router, useValue: routerSpy },
                { provide: GameViewCombatService, useValue: combatServiceSpy },
                { provide: GameViewListenersService, useValue: listenersServiceSpy },
            ],
        });
        service = TestBed.inject(GameViewService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
