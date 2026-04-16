import { Injectable, signal } from '@angular/core';
import { DEFAULT_COMBAT_POSTURE, ONE_SECOND_DELAY } from '@app/services/game-view/game-view.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Debuf, Posture } from '@common/character';
import { COMBAT_POSTURE_TIMEOUT_MS } from '@common/constants/combat-timeline.constants';
import { SocketNamespace } from '@common/enums';
import {
    CombatAttackAnimationData,
    CombatEndedData,
    CombatResult,
    CombatRoundCountdownData,
    CombatRoundResolvedData,
    CombatRoundStartedData,
    CombatStartedData,
    PostureReceivedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { GameLogicService } from './game-logic.service';

export interface CombatListenerDependencies {
    getLocalSocketId: () => string | undefined;
    getGameLobby: () => Lobby | null;
    getPlayerPositions: () => Record<string, Vec2>;
    updateGameLobby: (updater: (lobby: Lobby | null) => Lobby | null) => void;
    updatePlayerPositions: (updater: (positions: Record<string, Vec2>) => Record<string, Vec2>) => void;
    setFlagTaken: (value: boolean) => void;
}

interface CombatEndPopupData { title: string; message: string; }

@Injectable({
    providedIn: 'root',
})
export class GameViewCombatService {
    readonly isCombatStarted = signal<boolean>(false);
    readonly isRoundTransitioning = signal<boolean>(false);
    readonly combatRoundIndex = signal<number>(1);
    readonly combatPostureCountdown = signal<number>(0);
    readonly combatPostureCountdownMax = signal<number>(0);
    readonly combatInitiatorName = signal<string>('');
    readonly combatAttackAnimation = signal<{ data: CombatAttackAnimationData; sequence: number } | null>(null);
    readonly fighters = signal<CombatStartedData>({ player: {} as Player, enemy: {} as Player, roomId: '' });
    readonly lastCombatResult = signal<CombatResult | null>(null);
    readonly lastCombatRoundResolved = signal<CombatRoundResolvedData | null>(null);
    readonly combatEndPopup = signal<CombatEndPopupData | null>(null);

    constructor(private readonly gameLogicService: GameLogicService) {}
    private webSocketService: WebSocketService | null = null;
    private namespace: SocketNamespace | null = null;
    private listenersRegistered = false;
    private combatAttackAnimationSequence = 0;

    setupListeners(webSocketService: WebSocketService, namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.webSocketService = webSocketService;
        this.namespace = namespace;

        if (this.listenersRegistered) return;
        this.listenersRegistered = true;

        this.registerCombatResultListener(dependencies);
        this.registerCombatEndedListener(dependencies);
        this.registerCombatStartedListener(dependencies);
        this.registerCombatRoundStartedListener();
        this.registerCombatRoundCountdownListener();
        this.registerCombatRoundResolvedListener(dependencies);
        this.registerCombatAttackAnimationListener(dependencies);
        this.registerPostureReceivedListener();
    }

    sendPostureChoice(lobbyId: string, roomId: string, posture: Posture): void {
        if (!this.webSocketService || !this.namespace) return;
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.SendPosture, { lobbyId, roomId, posture });
    }

    getCurrentCombatRoomId(): string {
        return this.fighters().roomId;
    }

    completeCombatOverlay(): void {
        this.resetCombatState();
    }

    resetCombatState(): void {
        this.isCombatStarted.set(false);
        this.isRoundTransitioning.set(false);
        this.combatRoundIndex.set(1);
        this.combatPostureCountdown.set(0);
        this.combatPostureCountdownMax.set(0);
        this.combatInitiatorName.set('');
        this.combatAttackAnimation.set(null);
        this.fighters.set({ player: {} as Player, enemy: {} as Player, roomId: '' });
        this.lastCombatResult.set(null);
        this.lastCombatRoundResolved.set(null);
        this.combatEndPopup.set(null);
    }

    private registerCombatResultListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatResult>(this.namespace, JoinGameEvents.CombatResult, (data) => {
            this.handleCombatResult(data, dependencies);
        });
    }

    handleCombatResult(data: CombatResult, dependencies: CombatListenerDependencies): void {
        this.lastCombatResult.set(data);
        dependencies.updateGameLobby((lobby) => lobby ? this.gameLogicService.processCombatResult(lobby, data) : lobby);

        if (data.attacker.newPosition || data.defender.newPosition) {
            dependencies.updatePlayerPositions((positions) => {
                const updated = { ...positions };
                if (data.attacker.newPosition) updated[data.attacker.socketId] = data.attacker.newPosition;
                if (data.defender.newPosition) updated[data.defender.socketId] = data.defender.newPosition;
                return updated;
            });
        }

        if (data.wasFlagDropped) {
            dependencies.setFlagTaken(false);
        }

        this.updateLocalFightersFromCombatResult(data, dependencies.getLocalSocketId());
    }


    private updateLocalFightersFromCombatResult(data: CombatResult, localId: string | undefined): void {
        const localIsAttacker = data.attacker.socketId === localId;
        const localIsDefender = data.defender.socketId === localId;
        if (!this.isCombatStarted() || (!localIsAttacker && !localIsDefender)) return;

        const localResult = localIsAttacker ? data.attacker : data.defender;
        const enemyResult = localIsAttacker ? data.defender : data.attacker;

        this.fighters.update((fightData) => ({
            ...fightData,
            player: {
                ...fightData.player,
                character: {
                    ...fightData.player.character,
                    life: localResult.lifeAfter,
                    debuf: localResult.attack.penalty as Debuf,
                    bonusPosture: fightData.player.character.bonusPosture,
                },
            },
            enemy: {
                ...fightData.enemy,
                character: {
                    ...fightData.enemy.character,
                    life: enemyResult.lifeAfter,
                    debuf: enemyResult.attack.penalty as 2 | 0,
                    bonusPosture: fightData.enemy.character.bonusPosture,
                },
            },
        }));
    }

    private registerCombatEndedListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatEndedData>(this.namespace, JoinGameEvents.CombatEnded, (data) => {
            this.handleCombatEnded(data, dependencies.getGameLobby()?.players ?? [], dependencies.getLocalSocketId());
        });
    }

    handleCombatEnded(data: CombatEndedData, players: Player[], localId: string | undefined): void {
        if (!this.isLocalCombatEvent(data, localId)) return;
        const message = this.buildCombatEndedMessage(data, players);
        this.showCombatEndedPopup(message);
    }

    private isLocalCombatEvent(data: CombatEndedData, localId: string | undefined): boolean {
        return !!localId && (localId === data.attackerSocketId || localId === data.defenderSocketId);
    }

    private buildCombatEndedMessage(data: CombatEndedData, players: Player[]): string {
        const attackerName = players.find((player) => player.socketId === data.attackerSocketId)?.character.name ?? 'Attaquant';
        const defenderName = players.find((player) => player.socketId === data.defenderSocketId)?.character.name ?? 'Défenseur';
        const winnerName = players.find((player) => player.socketId === data.winnerId)?.character.name;
        const loserName = data.winnerId === data.attackerSocketId ? defenderName : attackerName;

        if (data.reason === 'abandon') {
            return `${loserName} a abandonné. ${winnerName ?? 'Un joueur'} gagne le combat.`;
        }
        if (data.attackerKilled && data.defenderKilled) {
            return 'Double K.O. Aucun gagnant du combat.';
        }
        if (data.winnerId) {
            return `${loserName} est mort. ${winnerName ?? 'Un joueur'} gagne le combat.`;
        }
        return 'Combat terminé.';
    }

    private showCombatEndedPopup(message: string): void {
        this.combatEndPopup.set({ title: 'Fin du combat', message });
    }

    private registerCombatStartedListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatStartedData>(this.namespace, JoinGameEvents.CombatStarted, (data) => {
            this.handleCombatStarted(data, dependencies);
        });
    }

    handleCombatStarted(data: CombatStartedData, dependencies: CombatListenerDependencies): void {
        const localId = dependencies.getLocalSocketId();
        if (!localId) return;

        const isLocalAttacker = data.player.socketId === localId;
        const isLocalDefender = data.enemy.socketId === localId;
        if (!isLocalAttacker && !isLocalDefender) {
            this.completeCombatOverlay();
            return;
        }

        const localPlayerData = isLocalAttacker
            ? data
            : { player: data.enemy, enemy: data.player, roomId: data.roomId };

        const normalizedCombatData = this.buildCombatStartData(localPlayerData, dependencies);

        this.combatInitiatorName.set(data.player.character.name);
        this.isCombatStarted.set(true);
        this.isRoundTransitioning.set(false);
        this.combatRoundIndex.set(1);
        this.combatPostureCountdown.set(0);
        this.combatPostureCountdownMax.set(0);
        this.fighters.set(normalizedCombatData);
    }

    private buildCombatStartData(
        localPlayerData: CombatStartedData,
        dependencies: CombatListenerDependencies,
    ): CombatStartedData {
        const playerPositions = dependencies.getPlayerPositions();
        const gameGrid = dependencies.getGameLobby()?.game.grid;

        const playerDebuff = this.resolveCombatStartIceDebuff(
            localPlayerData.player.socketId,
            localPlayerData.player.character.debuf,
            playerPositions,
            gameGrid,
        );

        const enemyDebuff = this.resolveCombatStartIceDebuff(
            localPlayerData.enemy.socketId,
            localPlayerData.enemy.character.debuf,
            playerPositions,
            gameGrid,
        );

        return {
            roomId: localPlayerData.roomId,
            player: {
                ...localPlayerData.player,
                character: {
                    ...localPlayerData.player.character,
                    bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                    debuf: playerDebuff,
                },
            },
            enemy: {
                ...localPlayerData.enemy,
                character: {
                    ...localPlayerData.enemy.character,
                    bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                    debuf: enemyDebuff,
                },
            },
        };
    }

    private resolveCombatStartIceDebuff(
        socketId: string,
        fallbackDebuff: Debuf | undefined,
        playerPositions: Record<string, Vec2>,
        gameGrid: Lobby['game']['grid'] | undefined,
    ): Debuf {
        const position = playerPositions[socketId];
        if (!position || !gameGrid) return fallbackDebuff ?? 0;
        return this.gameLogicService.getTileDebuff(gameGrid, position);
    }

    private registerCombatRoundStartedListener(): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatRoundStartedData>(this.namespace, JoinGameEvents.CombatRoundStarted, (data) => {
            this.handleCombatRoundStarted(data);
        });
    }

    handleCombatRoundStarted(data: CombatRoundStartedData): void {
        if (!this.isCombatStarted()) return;
        if (data.roomId !== this.fighters().roomId) return;

        this.isRoundTransitioning.set(false);
        this.combatRoundIndex.set(data.roundIndex);
        this.lastCombatRoundResolved.set(null);
        this.fighters.update((fightData) => ({
            ...fightData,
            player: {
                ...fightData.player,
                character: {
                    ...fightData.player.character,
                    bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                },
            },
            enemy: {
                ...fightData.enemy,
                character: {
                    ...fightData.enemy.character,
                    bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                },
            },
        }));
        const postureChoiceTimeoutMs = data.postureTimeoutMs > 0 ? data.postureTimeoutMs : COMBAT_POSTURE_TIMEOUT_MS;
        const countdownMax = Math.ceil(postureChoiceTimeoutMs / ONE_SECOND_DELAY);
        this.combatPostureCountdownMax.set(countdownMax);
        this.combatPostureCountdown.set(countdownMax);
    }

    private registerCombatRoundCountdownListener(): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatRoundCountdownData>(this.namespace, JoinGameEvents.CombatRoundCountdown, (data) => {
            this.handleCombatRoundCountdown(data);
        });
    }

    handleCombatRoundCountdown(data: CombatRoundCountdownData): void {
        if (!this.isCombatStarted()) return;
        if (data.roomId !== this.fighters().roomId) return;

        this.combatRoundIndex.set(data.roundIndex);
        if (data.secondsLeft > this.combatPostureCountdownMax()) {
            this.combatPostureCountdownMax.set(data.secondsLeft);
        }
        this.combatPostureCountdown.set(data.secondsLeft);
    }

    private registerCombatRoundResolvedListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatRoundResolvedData>(this.namespace, JoinGameEvents.CombatRoundResolved, (data) => {
            this.handleCombatRoundResolved(data, dependencies.getLocalSocketId());
        });
    }

    handleCombatRoundResolved(data: CombatRoundResolvedData, localId: string | undefined): void {
        if (!this.isCombatStarted()) return;
        if (data.roomId !== this.fighters().roomId) return;

        this.isRoundTransitioning.set(true);
        this.combatRoundIndex.set(data.roundIndex);
        this.combatPostureCountdown.set(0);
        this.lastCombatRoundResolved.set(data);

        if (!localId || !data.timedOutSocketIds?.includes(localId)) return;
    }

    private registerCombatAttackAnimationListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatAttackAnimationData>(this.namespace, JoinGameEvents.CombatAttackAnimation, (data) => {
            this.handleCombatAttackAnimation(data, dependencies.getLocalSocketId());
        });
    }

    handleCombatAttackAnimation(data: CombatAttackAnimationData, localId: string | undefined): void {
        if (!localId) return;

        const isParticipant = localId === data.attackerSocketId || localId === data.defenderSocketId;
        if (!isParticipant) return;

        this.isRoundTransitioning.set(true);
        this.combatPostureCountdown.set(0);

        this.combatAttackAnimationSequence += 1;
        this.combatAttackAnimation.set({
            data,
            sequence: this.combatAttackAnimationSequence,
        });
    }

    private registerPostureReceivedListener(): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<PostureReceivedData>(this.namespace, JoinGameEvents.PostureReceived, (data) => {
            this.handlePostureReceived(data);
        });
    }

    handlePostureReceived(data: PostureReceivedData): void {
        const { socketId, posture } = data;
        if (!this.isCombatStarted() || socketId !== this.fighters().enemy.socketId) return;
        this.fighters.update((fightData) => ({
            ...fightData,
            enemy: { ...fightData.enemy, character: { ...fightData.enemy.character, bonusPosture: posture } },
        }));
    }
}
