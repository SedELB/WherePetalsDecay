import { TestBed } from '@angular/core/testing';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { ONE_SECOND_MS } from '@app/services/game-view/game-view.constants';
import { Posture } from '@common/character';
import { COMBAT_POSTURE_TIMEOUT_MS } from '@common/constants/combat-timeline.constants';
import { DiceType, PlayerType, PostureType, SocketNamespace } from '@common/enums';
import {
    CombatAttackAnimationData, CombatEndedData, CombatFighterResult, CombatResult,
    CombatRoundCountdownData, CombatRoundResolvedData, CombatRoundStartedData,
    CombatStartedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';

const BASE_LIFE = 6;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;
const BASE_SPEED = 4;
const LIFE_AFTER_HIT = 4;
const DAMAGE_DEALT = 2;
const ROUND_ONE = 1;
const ROUND_TWO = 2;
const EXPECTED_COUNTDOWN_MAX = Math.ceil(COMBAT_POSTURE_TIMEOUT_MS / ONE_SECOND_MS);
const COUNTDOWN_SEVEN = 7;
const OVERFLOW_CONSTANT = 5;
const COUNTDOWN_OVERFLOW = EXPECTED_COUNTDOWN_MAX + OVERFLOW_CONSTANT;

const ATTACKER_SOCKET = 'attacker';
const DEFENDER_SOCKET = 'defender';
const SPECTATOR_SOCKET = 'spectator';
const ROOM_ID = 'room-1';
const LOBBY_ID = 'lobby-1';


const buildPlayer = (socketId: string, overrides: Partial<Player> = {}): Player => ({
    socketId, isHost: false, winsCount: 0, hasAbandonned: false, playerType: PlayerType.Reel,
    hasFlag: false, combatCount: 0, lossCount: 0, totalHpLost: 0, totalHpDealt: 0, visitedTilesCount: 0,
    character: {
        name: `Player-${socketId}`, avatar: 'avatar.png', life: BASE_LIFE, speed: BASE_SPEED,
        attack: BASE_ATTACK, defense: BASE_DEFENSE, lifeBonus: false,
        attackDice: DiceType.D6, defenseDice: DiceType.D4,
    },
    ...overrides,
});

const buildFighterResult = (socketId: string, killed = false): CombatFighterResult => ({
    socketId,
    attack: { base: BASE_ATTACK, postureBonus: 0, diceBonus: 1, penalty: 0, total: BASE_ATTACK + 1 },
    defense: { base: BASE_DEFENSE, postureBonus: 0, diceBonus: 0, penalty: 0, total: BASE_DEFENSE },
    damageDealt: DAMAGE_DEALT, lifeBefore: BASE_LIFE, lifeAfter: LIFE_AFTER_HIT,
    killed, oldPosition: { x: 0, y: 0 }, newPosition: null,
});

const buildCombatStarted = (attacker: string, defender: string, roomId = ROOM_ID): CombatStartedData => ({
    player: buildPlayer(attacker), enemy: buildPlayer(defender), roomId,
});

const buildBaseDeps = (localId: string | undefined) => ({
    getLocalSocketId: () => localId,
    getPlayerPositions: () => ({ [ATTACKER_SOCKET]: { x: 0, y: 0 }, [DEFENDER_SOCKET]: { x: 0, y: 1 } }),
    getGameLobby: (): Lobby | null => null,
    updateGameLobby: () => {
        // noop
    },
    updatePlayerPositions: () => {
        // noop
    },
    setFlagTaken: () => {
        // noop
    },
});


describe('GameViewCombatService', () => {
    let service: GameViewCombatService;
    let webSocketSpy: jasmine.SpyObj<WebSocketService>;

    beforeEach(() => {
        webSocketSpy = jasmine.createSpyObj<WebSocketService>('WebSocketService', ['emitNamespace', 'onNamespace', 'getSocketId']);

        TestBed.configureTestingModule({
            providers: [
                GameViewCombatService,
                { provide: WebSocketService, useValue: webSocketSpy },
            ],
        });
        service = TestBed.inject(GameViewCombatService);
    });

    it('should instantiate and initialise signals correctly', () => {
        expect(service).toBeTruthy();
        expect(service.isCombatStarted()).toBe(false);
        expect(service.combatRoundIndex()).toBe(ROUND_ONE);
        expect(service.combatPostureCountdown()).toBe(0);
        expect(service.lastCombatResult()).toBeNull();
        expect(service.combatEndPopup()).toBeNull();
        expect(service.combatAttackAnimation()).toBeNull();
        expect(service.lastCombatRoundResolved()).toBeNull();
        expect(service.getCurrentCombatRoomId()).toBe('');
    });

    describe('resetCombatState / completeCombatOverlay', () => {
        it('should reset signals to defaults when reset and via completeCombatOverlay', () => {
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET));
            service.resetCombatState();
            expect(service.isCombatStarted()).toBe(false);
            expect(service.combatRoundIndex()).toBe(ROUND_ONE);

            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET));
            service.completeCombatOverlay();
            expect(service.isCombatStarted()).toBe(false);
        });
    });

    describe('getCurrentCombatRoomId', () => {
        it('should return active room ID when combat is started', () => {
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET, ROOM_ID), buildBaseDeps(ATTACKER_SOCKET));
            expect(service.getCurrentCombatRoomId()).toBe(ROOM_ID);
        });
    });

    describe('handleCombatStarted', () => {
        it('should start combat for attacker/defender and reset initial state', () => {
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET));
            expect(service.isCombatStarted()).toBe(true);
            expect(service.combatInitiatorName()).toBe(`Player-${ATTACKER_SOCKET}`);
            expect(service.combatRoundIndex()).toBe(ROUND_ONE);

            service.resetCombatState();
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(DEFENDER_SOCKET));
            expect(service.isCombatStarted()).toBe(true);
        });

        it('should NOT start combat for spectator or undefined localId', () => {
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(SPECTATOR_SOCKET));
            expect(service.isCombatStarted()).toBe(false);

            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(undefined));
            expect(service.isCombatStarted()).toBe(false);
        });
    });

    describe('handleCombatRoundStarted', () => {
        const roundData: CombatRoundStartedData = { roomId: ROOM_ID, roundIndex: ROUND_TWO, postureTimeoutMs: COMBAT_POSTURE_TIMEOUT_MS };

        beforeEach(() => service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET)));

        it('should advance round index, set countdown, clear old resolved result, and fallback to timeout', () => {
            service.handleCombatRoundStarted(roundData);
            expect(service.combatRoundIndex()).toBe(ROUND_TWO);
            expect(service.combatPostureCountdown()).toBe(EXPECTED_COUNTDOWN_MAX);
            expect(service.lastCombatRoundResolved()).toBeNull();

            service.handleCombatRoundStarted({ ...roundData, postureTimeoutMs: 0 });
            expect(service.combatPostureCountdown()).toBe(EXPECTED_COUNTDOWN_MAX);
        });

        it('should ignore events from other rooms or before combat starts', () => {
            service.handleCombatRoundStarted({ ...roundData, roomId: 'other-room' });
            expect(service.combatRoundIndex()).toBe(ROUND_ONE);

            service.resetCombatState();
            service.handleCombatRoundStarted(roundData);
            expect(service.combatRoundIndex()).toBe(ROUND_ONE);
        });
    });

    describe('handleCombatRoundCountdown', () => {
        const countdownData: CombatRoundCountdownData = { roomId: ROOM_ID, roundIndex: ROUND_ONE, secondsLeft: COUNTDOWN_SEVEN };

        beforeEach(() => {
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET));
            service.handleCombatRoundStarted({ roomId: ROOM_ID, roundIndex: ROUND_ONE, postureTimeoutMs: COMBAT_POSTURE_TIMEOUT_MS });
        });

        it('should update countdown, expand max if needed, and ignore invalid states', () => {
            service.handleCombatRoundCountdown(countdownData);
            expect(service.combatPostureCountdown()).toBe(COUNTDOWN_SEVEN);

            service.handleCombatRoundCountdown({ ...countdownData, secondsLeft: COUNTDOWN_OVERFLOW });
            expect(service.combatPostureCountdownMax()).toBe(COUNTDOWN_OVERFLOW);

            service.handleCombatRoundCountdown({ ...countdownData, roomId: 'other-room' });
            expect(service.combatPostureCountdown()).toBe(COUNTDOWN_OVERFLOW);
        });
    });

    describe('handleCombatRoundResolved', () => {
        const result: CombatRoundResolvedData = {
            roomId: ROOM_ID, roundIndex: ROUND_ONE,
            result: { attacker: buildFighterResult(ATTACKER_SOCKET), defender: buildFighterResult(DEFENDER_SOCKET), winnerId: null, loserId: null },
        };

        beforeEach(() => service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET)));

        it('should store resolved data and reset countdown, ignoring invalid room or state', () => {
            service.handleCombatRoundResolved(result, ATTACKER_SOCKET);
            expect(service.lastCombatRoundResolved()).toEqual(result);
            expect(service.combatPostureCountdown()).toBe(0);

            service.handleCombatRoundResolved({ ...result, roomId: 'other-room' }, ATTACKER_SOCKET);
            service.resetCombatState();
            service.handleCombatRoundResolved(result, ATTACKER_SOCKET);
            expect(service.lastCombatRoundResolved()).toBeNull();
        });
    });

    describe('handleCombatResult', () => {
        let updateLobby: jasmine.Spy;
        let updatePos: jasmine.Spy;
        let setFlag: jasmine.Spy;

        const res: CombatResult = {
            attacker: buildFighterResult(ATTACKER_SOCKET), defender: buildFighterResult(DEFENDER_SOCKET), winnerId: null, loserId: null,
        };

        beforeEach(() => {
            updateLobby = jasmine.createSpy('updateLobby');
            updatePos = jasmine.createSpy('updatePos');
            setFlag = jasmine.createSpy('setFlag');
            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET));
        });

        const makeDeps = () => ({
            getLocalSocketId: () => ATTACKER_SOCKET as string | undefined,
            updateGameLobby: updateLobby,
            updatePlayerPositions: updatePos,
            setFlagTaken: setFlag,
            getGameLobby: (): Lobby | null => null,
            getPlayerPositions: () => ({}),
        });

        it('should store result, update lobby, handle movement correctly, and handle flags', () => {
            service.handleCombatResult(res, makeDeps());
            expect(service.lastCombatResult()).toEqual(res);
            expect(updateLobby).toHaveBeenCalled();
            expect(updatePos).not.toHaveBeenCalled();
            expect(setFlag).not.toHaveBeenCalled();

            service.handleCombatResult({ ...res, attacker: { ...res.attacker, newPosition: { x: 2, y: 3 } } }, makeDeps());
            expect(updatePos).toHaveBeenCalled();

            service.handleCombatResult({ ...res, wasFlagDropped: true }, makeDeps());
            expect(setFlag).toHaveBeenCalledWith(false);
        });
    });

    describe('handleCombatEnded', () => {
        const players = [buildPlayer(ATTACKER_SOCKET), buildPlayer(DEFENDER_SOCKET)];
        const endedDeath: CombatEndedData = {
            roomId: ROOM_ID, attackerSocketId: ATTACKER_SOCKET, defenderSocketId: DEFENDER_SOCKET,
            attackerKilled: false, defenderKilled: true, winnerId: ATTACKER_SOCKET, reason: 'death',
        };

        it('should display popup with correct messaging for local participants and ignore others', () => {
            service.handleCombatEnded(endedDeath, players, ATTACKER_SOCKET);
            expect(service.combatEndPopup()?.title).toBe('Fin du combat');
            expect(service.combatEndPopup()?.message).toContain(`Player-${DEFENDER_SOCKET}`);

            service.resetCombatState(); // Clear state
            service.handleCombatEnded(endedDeath, players, SPECTATOR_SOCKET);
            expect(service.combatEndPopup()).toBeNull();

            service.resetCombatState(); // Clear state
            service.handleCombatEnded(endedDeath, players, undefined);
            expect(service.combatEndPopup()).toBeNull();

            service.handleCombatEnded({ ...endedDeath, reason: 'abandon' }, players, ATTACKER_SOCKET);
            expect(service.combatEndPopup()?.message).toContain('abandon');

            service.handleCombatEnded({ ...endedDeath, attackerKilled: true, winnerId: null }, players, ATTACKER_SOCKET);
            expect(service.combatEndPopup()?.message).toContain('Double K.O.');

            service.handleCombatEnded(endedDeath, [], ATTACKER_SOCKET);
            expect(service.combatEndPopup()?.message).toContain('Défenseur');
        });
    });

    describe('handleCombatAttackAnimation', () => {
        const animData: CombatAttackAnimationData = {
            lobbyId: LOBBY_ID, attackerSocketId: ATTACKER_SOCKET, defenderSocketId: DEFENDER_SOCKET, durationMs: 500,
        };

        it('should trigger animation and transitioning for participants, incrementing sequence id', () => {
            service.handleCombatAttackAnimation(animData, ATTACKER_SOCKET);
            expect(service.combatAttackAnimation()).not.toBeNull();
            expect(service.isRoundTransitioning()).toBe(true);
            expect(service.combatPostureCountdown()).toBe(0);

            const seq1 = service.combatAttackAnimation()?.sequence ?? 0;
            service.handleCombatAttackAnimation(animData, ATTACKER_SOCKET);
            expect((service.combatAttackAnimation()?.sequence ?? 0)).toBeGreaterThan(seq1);

            service.resetCombatState(); // Clear state
            service.handleCombatAttackAnimation(animData, SPECTATOR_SOCKET);
            expect(service.combatAttackAnimation()).toBeNull();
        });
    });

    describe('handlePostureReceived and sendPostureChoice and setupListeners', () => {
        const posture: Posture = { type: PostureType.Attack, bonus: 2 };
        beforeEach(() => service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET)));

        it('should handle posture updates and ignore local or unstarted posturing', () => {
            service.handlePostureReceived({ socketId: DEFENDER_SOCKET, posture });
            expect(service.fighters().enemy.character.bonusPosture).toEqual(posture);

            service.handleCombatStarted(buildCombatStarted(ATTACKER_SOCKET, DEFENDER_SOCKET), buildBaseDeps(ATTACKER_SOCKET)); // reset state to defaults
            service.handlePostureReceived({ socketId: ATTACKER_SOCKET, posture });
            expect(service.fighters().enemy.character.bonusPosture).toEqual({ type: null, bonus: 0 } as unknown as Posture);

            service.resetCombatState();
            service.handlePostureReceived({ socketId: DEFENDER_SOCKET, posture });
            expect(service.fighters().enemy.character?.bonusPosture).toBeUndefined();
        });

        it('should emit posture after listening setup', () => {
            service.setupListeners(webSocketSpy, SocketNamespace.Combat, buildBaseDeps(ATTACKER_SOCKET));
            service.sendPostureChoice(LOBBY_ID, ROOM_ID, posture);
            expect(webSocketSpy.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Combat, JoinGameEvents.SendPosture, jasmine.objectContaining({ lobbyId: LOBBY_ID, roomId: ROOM_ID, posture }),
            );
        });

        it('should not double-register listeners or emit if omitted', () => {
            service.sendPostureChoice(LOBBY_ID, ROOM_ID, posture);
            expect(webSocketSpy.emitNamespace).not.toHaveBeenCalled();

            service.setupListeners(webSocketSpy, SocketNamespace.Combat, buildBaseDeps(ATTACKER_SOCKET));
            const count = webSocketSpy.onNamespace.calls.count();
            service.setupListeners(webSocketSpy, SocketNamespace.Combat, buildBaseDeps(ATTACKER_SOCKET));
            expect(webSocketSpy.onNamespace.calls.count()).toEqual(count);
        });
    });
});
