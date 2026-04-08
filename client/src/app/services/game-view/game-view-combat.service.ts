import { Injectable, signal } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Debuf, Posture } from '@common/character';
import { SocketNamespace, TileItem } from '@common/enums';
import {
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
import swal from 'sweetalert2';

const ONE_SECOND_DELAY = 1000;
const COMBAT_END_NOTIFICATION_DELAY = 3000;
const DEFAULT_COMBAT_POSTURE: Posture = { type: null, bonus: 0 };

interface CombatListenerDependencies {
    getLocalSocketId: () => string | undefined;
    getGameLobby: () => Lobby | null;
    updateGameLobby: (updater: (lobby: Lobby | null) => Lobby | null) => void;
    updatePlayerPositions: (updater: (positions: Record<string, Vec2>) => Record<string, Vec2>) => void;
    setFlagTaken: (value: boolean) => void;
}

@Injectable({
    providedIn: 'root',
})
export class GameViewCombatService {
    readonly isCombatStarted = signal<boolean>(false);
    readonly combatRoundIndex = signal<number>(1);
    readonly combatPostureCountdown = signal<number>(0);
    readonly fighters = signal<CombatStartedData>({ player: {} as Player, enemy: {} as Player, roomId: '' });
    readonly lastCombatResult = signal<CombatResult | null>(null);

    private webSocketService: WebSocketService | null = null;
    private namespace: SocketNamespace | null = null;
    private listenersRegistered = false;

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
        this.combatRoundIndex.set(1);
        this.combatPostureCountdown.set(0);
        this.fighters.set({ player: {} as Player, enemy: {} as Player, roomId: '' });
        this.lastCombatResult.set(null);
    }

    private registerCombatResultListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatResult>(this.namespace, JoinGameEvents.CombatResult, (data) => {
            this.handleCombatResult(data, dependencies);
        });
    }

    private handleCombatResult(data: CombatResult, dependencies: CombatListenerDependencies): void {
        this.lastCombatResult.set(data);
        this.updateLobbyFromCombatResult(data, dependencies);
        this.updatePositionsFromCombatResult(data, dependencies);
        this.updateDroppedFlagFromCombatResult(data, dependencies);
        this.updateLocalFightersFromCombatResult(data, dependencies.getLocalSocketId());
    }

    private updateLobbyFromCombatResult(data: CombatResult, dependencies: CombatListenerDependencies): void {
        dependencies.updateGameLobby((lobby) => {
            if (!lobby) return lobby;

            const updatedPlayers = lobby.players.map((player) => {
                if (player.socketId === data.attacker.socketId) {
                    return {
                        ...player,
                        winsCount: player.winsCount + (data.winnerId === data.attacker.socketId ? 1 : 0),
                        lossCount: player.lossCount + (data.attacker.killed ? 1 : 0),
                        combatCount: player.combatCount++,
                        totalHpDealt: player.totalHpDealt + data.attacker.damageDealt,
                        totalHpLost: player.totalHpLost + data.defender.damageDealt,
                        character: {
                            ...player.character,
                            life: data.attacker.lifeAfter,
                            debuf: data.attacker.attack.penalty as Debuf,
                        },
                    };
                }

                if (player.socketId === data.defender.socketId) {
                    return {
                        ...player,
                        winsCount: player.winsCount + (data.winnerId === data.defender.socketId ? 1 : 0),
                        lossCount: player.lossCount + (data.defender.killed ? 1 : 0),
                        combatCount: player.combatCount + 1,
                        totalHpDealt: player.totalHpDealt + data.defender.damageDealt,
                        totalHpLost: player.totalHpLost + data.attacker.damageDealt,
                        character: {
                            ...player.character,
                            life: data.defender.lifeAfter,
                            debuf: data.defender.attack.penalty as Debuf,
                        },
                    };
                }

                return player;
            });

            return { ...lobby, players: updatedPlayers };
        });
    }

    private updatePositionsFromCombatResult(data: CombatResult, dependencies: CombatListenerDependencies): void {
        if (data.attacker.newPosition) {
            dependencies.updatePlayerPositions((positions) => ({
                ...positions,
                [data.attacker.socketId]: data.attacker.newPosition as Vec2,
            }));
        }

        if (data.defender.newPosition) {
            dependencies.updatePlayerPositions((positions) => ({
                ...positions,
                [data.defender.socketId]: data.defender.newPosition as Vec2,
            }));
        }
    }

    private updateDroppedFlagFromCombatResult(data: CombatResult, dependencies: CombatListenerDependencies): void {
        if (!data.wasFlagDropped || !data.droppedFlagPosition) return;

        const droppedFlagPosition = data.droppedFlagPosition;
        dependencies.updateGameLobby((lobby) => {
            if (!lobby) return lobby;

            lobby.game.grid[droppedFlagPosition.y][droppedFlagPosition.x].item = TileItem.Flag;
            const updatedPlayers = lobby.players.map((player) => {
                if (player.socketId === data.attacker.socketId || player.socketId === data.defender.socketId) {
                    return { ...player, hasFlag: false };
                }
                return player;
            });

            return { ...lobby, players: updatedPlayers };
        });

        dependencies.setFlagTaken(false);
    }

    private updateLocalFightersFromCombatResult(data: CombatResult, localId: string | undefined): void {
        const localIsAttacker = data.attacker.socketId === localId;
        const localIsDefender = data.defender.socketId === localId;
        if (!this.isCombatStarted() || (!localIsAttacker && !localIsDefender)) return;

        const localResult = localIsAttacker ? data.attacker : data.defender;
        const enemyResult = localIsAttacker ? data.defender : data.attacker;
        const isCombatContinuing = !localResult.killed && !enemyResult.killed;

        this.fighters.update((fightData) => ({
            ...fightData,
            player: {
                ...fightData.player,
                character: {
                    ...fightData.player.character,
                    life: localResult.lifeAfter,
                    debuf: localResult.attack.penalty as Debuf,
                    bonusPosture: isCombatContinuing ? { ...DEFAULT_COMBAT_POSTURE } : fightData.player.character.bonusPosture,
                },
            },
            enemy: {
                ...fightData.enemy,
                character: {
                    ...fightData.enemy.character,
                    life: enemyResult.lifeAfter,
                    debuf: enemyResult.attack.penalty as 2 | 0,
                    bonusPosture: isCombatContinuing ? { ...DEFAULT_COMBAT_POSTURE } : fightData.enemy.character.bonusPosture,
                },
            },
        }));
    }

    private registerCombatEndedListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatEndedData>(this.namespace, JoinGameEvents.CombatEnded, (data) => {
            if (!this.isLocalCombatEvent(data, dependencies.getLocalSocketId())) return;

            const message = this.buildCombatEndedMessage(data, dependencies.getGameLobby()?.players ?? []);
            this.showCombatEndedToast(message);
        });
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

    private showCombatEndedToast(message: string): void {
        void swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Fin du combat',
            text: message,
            showConfirmButton: false,
            showCloseButton: true,
            timer: COMBAT_END_NOTIFICATION_DELAY,
            timerProgressBar: true,
        }).then(() => {
            this.completeCombatOverlay();
        });
    }

    private registerCombatStartedListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatStartedData>(this.namespace, JoinGameEvents.CombatStarted, (data) => {
            const localId = dependencies.getLocalSocketId();
            const localPlayerData = data.player.socketId === localId
                ? data
                : { player: data.enemy, enemy: data.player, roomId: data.roomId };

            const normalizedCombatData: CombatStartedData = {
                roomId: localPlayerData.roomId,
                player: {
                    ...localPlayerData.player,
                    character: {
                        ...localPlayerData.player.character,
                        bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                    },
                },
                enemy: {
                    ...localPlayerData.enemy,
                    character: {
                        ...localPlayerData.enemy.character,
                        bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                    },
                },
            };

            this.isCombatStarted.set(true);
            this.combatRoundIndex.set(1);
            this.combatPostureCountdown.set(0);
            this.fighters.set(normalizedCombatData);
        });
    }

    private registerCombatRoundStartedListener(): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatRoundStartedData>(this.namespace, JoinGameEvents.CombatRoundStarted, (data) => {
            if (!this.isCombatStarted()) return;
            if (data.roomId !== this.fighters().roomId) return;

            this.combatRoundIndex.set(data.roundIndex);
            this.combatPostureCountdown.set(Math.ceil(data.postureTimeoutMs / ONE_SECOND_DELAY));
        });
    }

    private registerCombatRoundCountdownListener(): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatRoundCountdownData>(this.namespace, JoinGameEvents.CombatRoundCountdown, (data) => {
            if (!this.isCombatStarted()) return;
            if (data.roomId !== this.fighters().roomId) return;

            this.combatRoundIndex.set(data.roundIndex);
            this.combatPostureCountdown.set(data.secondsLeft);
        });
    }

    private registerCombatRoundResolvedListener(dependencies: CombatListenerDependencies): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<CombatRoundResolvedData>(this.namespace, JoinGameEvents.CombatRoundResolved, (data) => {
            if (!this.isCombatStarted()) return;
            if (data.roomId !== this.fighters().roomId) return;

            this.combatRoundIndex.set(data.roundIndex);
            this.combatPostureCountdown.set(0);

            const localId = dependencies.getLocalSocketId();
            if (!localId || !data.timedOutSocketIds?.includes(localId)) return;

            void swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'Posture par défaut',
                text: 'Temps écoulé : posture neutre appliquée pour ce round.',
                showConfirmButton: false,
                timer: COMBAT_END_NOTIFICATION_DELAY,
                timerProgressBar: true,
            });
        });
    }

    private registerPostureReceivedListener(): void {
        if (!this.webSocketService || !this.namespace) return;

        this.webSocketService.onNamespace<PostureReceivedData>(this.namespace, JoinGameEvents.PostureReceived, ({ socketId, posture }) => {
            if (!this.isCombatStarted() || socketId !== this.fighters().enemy.socketId) return;
            this.fighters.update((fightData) => ({
                ...fightData,
                enemy: { ...fightData.enemy, character: { ...fightData.enemy.character, bonusPosture: posture } },
            }));
        });
    }
}
