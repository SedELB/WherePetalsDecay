/* eslint-disable max-lines */
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Posture } from '@common/character';
import { Direction } from '@common/direction';
import { SocketNamespace, TileTexture } from '@common/enums';
import { GameStats } from '@common/interfaces/game-stats';
import {
    CombatLockStateData,
    GameOverEventData,
    GameStartedData,
    PlayerMovedData,
    TileInfoData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';
import { GameViewCombatService } from './game-view-combat.service';
import { getFirstTurnNotification, getNextTurnNotification } from './game-view-notification.utils';

const SANCTUARY_BLOCK_SIZE = 2;

const ONE_SECOND_DELAY = 1000;
const END_GAME_REDIRECT_DELAY = 5000;

@Injectable({
    providedIn: 'root',
})
export class GameViewService {
    private readonly namespace = SocketNamespace.Join;
    private closeFlagTransferSwal: (() => void) | null = null;
    readonly isDebugModeActive = signal<boolean>(false);
    readonly disableEndTurn = signal<boolean>(false);
    readonly gameLobby = signal<Lobby | null>(null);
    readonly playerPositions = signal<Record<string, Vec2>>({});
    readonly playerStartPositions = signal<Record<string, Vec2>>({});
    readonly turnOrder = signal<string[]>([]);
    readonly activePlayerSocketId = signal<string | null>(null);
    readonly turnCountdown = signal<number>(0);
    readonly turnCountdownMax = signal<number>(0);
    readonly reachableTiles = signal<Vec2[]>([]);
    readonly reachableTilesForTeleport = signal<Vec2[]>([]);
    readonly movementPoints = signal<number>(0);
    readonly actionPoints = signal<number>(0);
    readonly tileInfo = signal<TileInfoData | null>(null);
    readonly gameOver = signal<GameOverEventData | null>(null);
    readonly turnNotification = signal<string | null>(null);
    readonly inactiveSanctuaries = signal<Vec2[]>([]);
    readonly journalEntries = signal<string[]>([]);
    readonly isFlagTaken = signal<boolean>(false);
    readonly combatLockState = signal<CombatLockStateData | null>(null);
    readonly isCombatStarted = this.gameViewCombatService.isCombatStarted;
    readonly isCombatRoundTransitioning = this.gameViewCombatService.isRoundTransitioning;
    readonly combatRoundIndex = this.gameViewCombatService.combatRoundIndex;
    readonly combatPostureCountdown = this.gameViewCombatService.combatPostureCountdown;
    readonly combatPostureCountdownMax = this.gameViewCombatService.combatPostureCountdownMax;
    readonly combatInitiatorName = this.gameViewCombatService.combatInitiatorName;
    readonly combatAttackAnimation = this.gameViewCombatService.combatAttackAnimation;
    readonly fighters = this.gameViewCombatService.fighters;
    readonly lastCombatResult = this.gameViewCombatService.lastCombatResult;
    readonly combatEndPopup = this.gameViewCombatService.combatEndPopup;
    private readonly endGamePlayersSignal = signal<Player[]>([]);
    private readonly endGameStatsSignal = signal<GameStats | null>(null);

    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
        private readonly gameViewCombatService: GameViewCombatService,
    ) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace(this.namespace, JoinGameEvents.LeftLobby, () => {
            this.setLobby(null);
            this.combatLockState.set(null);
            this.router.navigate([ROUTES.home]);
        });

        this.webSocketService.onNamespace<GameStartedData>(this.namespace, JoinGameEvents.GameStarted, (data) => {
            this.resetGameState();
            this.setLobby(data.lobby);
            this.turnOrder.set(data.turnOrder);
            this.playerPositions.set(data.playerPositions);
            this.playerStartPositions.set(data.playerStartPositions);
            this.showFirstTurnNotification(data.turnOrder, data.lobby);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnStarted, (playerSocketId) => {
            this.activePlayerSocketId.set(playerSocketId);
            this.turnNotification.set(null);
            this.turnCountdownMax.set(0);
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.BetweenTurnCountdown, (secondsLeft) => {
            this.disableEndTurn.set(true);
            this.turnCountdown.set(secondsLeft);
            if (secondsLeft > this.turnCountdownMax()) {
                this.turnCountdownMax.set(secondsLeft);
            }
            if (secondsLeft <= 1) {
                setTimeout(() => {
                    this.disableEndTurn.set(false);
                }, ONE_SECOND_DELAY);
            }
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.TurnCountdown, (secondsLeft) => {
            this.turnCountdown.set(secondsLeft);
            if (secondsLeft > this.turnCountdownMax()) {
                this.turnCountdownMax.set(secondsLeft);
            }
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnEnded, (endedPlayerSocketId) => {
            this.activePlayerSocketId.set(null);
            this.reachableTiles.set([]);
            this.reachableTilesForTeleport.set([]);
            this.showNextTurnNotification(endedPlayerSocketId);
            if (this.closeFlagTransferSwal) {
                this.closeFlagTransferSwal();
                this.closeFlagTransferSwal = null;
            }
        });

        this.webSocketService.onNamespace<PlayerMovedData>(this.namespace, JoinGameEvents.PlayerMoved, (data) => {
            this.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));
            if (data.socketId === this.getLocalSocketId()) {
                this.movementPoints.set(data.movementPoints);
            }

            if (data.flagTaken) {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    lobby.game.grid[data.position.y][data.position.x].item = null;
                    const updatedPlayers = lobby.players.map((player) => {
                        if (player.socketId === data.socketId) return { ...player, hasFlag: true };
                        return player;
                    });
                    return { ...lobby, players: updatedPlayers };
                });
                this.isFlagTaken.set(true);
            }
        });

        this.webSocketService.onNamespace<PlayerMovedData>(this.namespace, JoinGameEvents.PlayerTeleported, (data) => {
            if (!this.isDebugModeActive()) return;
            this.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));

            if (data.flagTaken) {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    lobby.game.grid[data.position.y][data.position.x].item = null;
                    const updatedPlayers = lobby.players.map((player) => {
                        if (player.socketId === data.socketId) return { ...player, hasFlag: true };
                        return player;
                    });

                    return { ...lobby, players: updatedPlayers };
                });
                this.isFlagTaken.set(true);
            }
        });

        this.webSocketService.onNamespace<boolean>(this.namespace, JoinGameEvents.DebugToggled, (isEnabled) => {
            this.isDebugModeActive.set(isEnabled);
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(this.namespace, JoinGameEvents.ReachableTiles, (data) => {
            if (data.socketId === this.getLocalSocketId()) {
                this.reachableTiles.set(data.tiles);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(this.namespace, JoinGameEvents.ReachableTilesForTeleport, (data) => {
            if (data.socketId === this.getLocalSocketId()) {
                this.reachableTilesForTeleport.set(data.tiles);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; movementPoints: number }>(this.namespace, JoinGameEvents.MovementPoints, (data) => {
            if (data.socketId === this.getLocalSocketId()) {
                this.movementPoints.set(data.movementPoints);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; actionPoints: number }>(this.namespace, JoinGameEvents.ActionPoints, (data) => {
            if (data.socketId === this.getLocalSocketId()) {
                this.actionPoints.set(data.actionPoints);
            }
        });

        this.webSocketService.onNamespace<{ giverPlayerId: string; targetPlayerId: string }>(
            this.namespace,
            JoinGameEvents.FlagTransferred,
            ({ giverPlayerId, targetPlayerId }) => {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const giver = lobby.players.find((player) => player.socketId === giverPlayerId);
                    const taker = lobby.players.find((player) => player.socketId === targetPlayerId);
                    if (!giver || !taker) return lobby;
                    taker.hasFlag = true;
                    giver.hasFlag = false;
                    return { ...lobby };
                });
            },
        );

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            this.namespace,
            JoinGameEvents.GiveFlagResponse,
            ({ requesterId, requesterName, lobbyId }) => this.promptFlagTransfer(requesterId, requesterName, lobbyId),
        );

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            this.namespace,
            JoinGameEvents.RequestFlagResponse,
            ({ requesterId, requesterName, lobbyId }) => this.promptFlagTransfer(requesterId, requesterName, lobbyId, true),
        );

        this.webSocketService.onNamespace<{ socketId: string; updatedLobby: Lobby }>(this.namespace,
            JoinGameEvents.PlayerAbandoned, ({ socketId, updatedLobby }) => {
                this.playerPositions.update((positions) => {
                    const updated = { ...positions };
                    delete updated[socketId];
                    return updated;
                });
                this.setLobby(updatedLobby);
            });

        this.webSocketService.onNamespace<GameOverEventData>(this.namespace, JoinGameEvents.GameOver, (data) => {
            this.handleGameOverEvent(data);
        });

        this.webSocketService.onNamespace<CombatLockStateData>(
            this.namespace,
            JoinGameEvents.CombatLockStateChanged,
            (data) => this.combatLockState.set(data.isLocked ? data : null),
        );

        this.webSocketService.onNamespace<TileInfoData>(this.namespace, JoinGameEvents.TileInfo, (data) => {
            this.tileInfo.set(data);
        });

        this.webSocketService.onNamespace<{ position: Vec2; newType: TileTexture }>(
            this.namespace, JoinGameEvents.DoorToggled, (data) => {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const updatedGrid = lobby.game.grid.map((row, y) =>
                        row.map((tile, x) =>
                            x === data.position.x && y === data.position.y ? { ...tile, type: data.newType } : tile,
                        ),
                    );
                    return { ...lobby, game: { ...lobby.game, grid: updatedGrid } };
                });
            },
        );

        this.webSocketService.onNamespace<{ inactiveSanctuaries: Vec2[] }>(
            this.namespace, JoinGameEvents.SanctuaryStateUpdate, (data) => {
                this.inactiveSanctuaries.set(this.expandSanctuaryPositions(data.inactiveSanctuaries));
            },
        );

        this.webSocketService.onNamespace<{
            socketId: string; sanctuaryType: string; mode: string;
            healAmount: number; combatBonusApplied: boolean;
            playerNewLife: number; playerName: string; inactiveSanctuaries: Vec2[];
        }>(this.namespace, JoinGameEvents.SanctuaryUsed, (data) => {
            this.inactiveSanctuaries.set(this.expandSanctuaryPositions(data.inactiveSanctuaries));
            if (data.healAmount > 0) {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const updatedPlayers = lobby.players.map((p) =>
                        p.socketId === data.socketId
                            ? { ...p, character: { ...p.character, life: data.playerNewLife } }
                            : p,
                    );
                    return { ...lobby, players: updatedPlayers };
                });
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; attack: number; defense: number; life: number }>(
            this.namespace, JoinGameEvents.PlayerStatsUpdate, (data) => {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const updatedPlayers = lobby.players.map((p) =>
                        p.socketId === data.socketId
                            ? { ...p, character: { ...p.character, attack: data.attack, defense: data.defense, life: data.life } }
                            : p,
                    );
                    return { ...lobby, players: updatedPlayers };
                });
            },
        );

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.JournalEntry, (message) => {
            this.journalEntries.update((entries) => [...entries, message]);
        });

        this.gameViewCombatService.setupListeners(this.webSocketService, this.namespace, {
            getLocalSocketId: () => this.getLocalSocketId(),
            getGameLobby: () => this.gameLobby(),
            updateGameLobby: (updater) => this.gameLobby.update(updater),
            updatePlayerPositions: (updater) => this.playerPositions.update(updater),
            setFlagTaken: (value) => this.isFlagTaken.set(value),
        });
    }

    private handleGameOverEvent(data: GameOverEventData): void {
        if (!this.shouldHandleGameOverEvent(data)) return;

        if (data.winnerSocketId !== undefined || data.isForfeit !== undefined || data.abandonTeam !== undefined) {
            this.gameOver.set(data);
        }
        if (data.players) this.endGamePlayersSignal.set(data.players);
        if (data.gameStats) this.endGameStatsSignal.set(data.gameStats);
        const gameOverMessage = this.buildGameOverMessage(data);

        void swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Fin de partie',
            text: gameOverMessage,
            showConfirmButton: false,
            showCloseButton: true,
            timer: END_GAME_REDIRECT_DELAY,
            timerProgressBar: true,
        });

        setTimeout(() => {
            this.router.navigate([ROUTES.endGame]);
        }, END_GAME_REDIRECT_DELAY);
    }

    private shouldHandleGameOverEvent(data: GameOverEventData): boolean {
        const localSocketId = this.getLocalSocketId();
        if (!localSocketId) return false;

        if (data.players && data.players.length > 0) {
            return data.players.some((player) => player.socketId === localSocketId);
        }

        const lobbyPlayers = this.gameLobby()?.players;
        if (lobbyPlayers && lobbyPlayers.length > 0) {
            return lobbyPlayers.some((player) => player.socketId === localSocketId);
        }

        return true;
    }

    private buildGameOverMessage(data: GameOverEventData): string {
        const winnerName = data.players?.find((player) => player.socketId === data.winnerSocketId)?.character.name;
        if (data.abandonTeam) return `L'équipe ${data.abandonTeam} a abandonné. Fin de partie.`;
        if (winnerName) return `${winnerName} remporte la partie.`;
        return 'Partie terminée.';
    }

    sendPostureChoice(lobbyId: string, roomId: string, posture: Posture): void {
        this.gameViewCombatService.sendPostureChoice(lobbyId, roomId, posture);
    }

    completeCombatOverlay(): void {
        this.gameViewCombatService.completeCombatOverlay();
    }

    getCurrentCombatRoomId(): string {
        return this.gameViewCombatService.getCurrentCombatRoomId();
    }

    endGamePlayers(): Player[] {
        return this.endGamePlayersSignal();
    }

    endGameStats(): GameStats | null {
        return this.endGameStatsSignal();
    }

    sendMove(lobbyId: string, direction: Direction): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestMove, { lobbyId, direction });
    }

    teleportMove(lobbyId: string, position: Vec2): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.Teleport, { lobbyId, position });
    }

    toggleDebugMode(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.ToggleDebugMode, { lobbyId, state: this.isDebugModeActive() });
    }

    sendEndTurn(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.EndTurn, lobbyId);
    }

    sendAbandon(lobbyId: string): void {
        if (this.isHost() && this.isDebugModeActive()) {
            this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.ToggleDebugMode, { lobbyId, state: this.isDebugModeActive() });
        }
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.PlayerAbandon, lobbyId);
    }

    sendAbandonWithoutPrompt(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.PlayerAbandon, lobbyId);
    }

    sendCombat(lobbyId: string, player: Player, enemy: Player): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestCombat, { lobbyId, player, enemy });
    }

    giveFlagTransfer(lobbyId: string, targetSocketId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.GiveFlagRequest, { lobbyId, targetSocketId });
    }

    requestFlagTransfer(lobbyId: string, targetSocketId: string | undefined): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestFlagRequest, { lobbyId, targetSocketId });
    }

    sendToggleDoor(lobbyId: string, position: Vec2): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestToggleDoor, { lobbyId, position });
    }

    sendUseSanctuary(lobbyId: string, position: Vec2, mode: 'normal' | 'doubleOrNothing'): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestUseSanctuary, { lobbyId, position, mode });
    }

    private expandSanctuaryPositions(topLeftList: Vec2[]): Vec2[] {
        const expanded: Vec2[] = [];
        for (const tl of topLeftList) {
            for (let dy = 0; dy < SANCTUARY_BLOCK_SIZE; dy++) {
                for (let dx = 0; dx < SANCTUARY_BLOCK_SIZE; dx++) {
                    expanded.push({ x: tl.x + dx, y: tl.y + dy });
                }
            }
        }
        return expanded;
    }

    sendTileInfoRequest(lobbyId: string, position: Vec2): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestTileInfo, { lobbyId, position });
    }

    leaveEndGame(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.LeaveEndGame, lobbyId);
    }

    private promptFlagTransfer(requesterId: string, requesterName: string, lobbyId: string, isRequest = false): void {
        this.closeFlagTransferSwal = () => swal.close();
        swal.fire({
            title: 'Transfert de drapeau',
            text: `${requesterName} veut ${isRequest ? 'avoir' : 'vous passer'} le drapeau.`,
            icon: 'question',
            confirmButtonText: 'Accepter',
            cancelButtonText: 'Refuser',
            showCancelButton: true,
            timer: undefined,
            allowOutsideClick: false,
        }).then((result) => {
            this.closeFlagTransferSwal = null;
            this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.FlagTransferResponse, {
                lobbyId,
                requesterId,
                accepted: result.isConfirmed,
                isRequest,
            });
        });
    }

    private resetGameState(): void {
        this.isDebugModeActive.set(false);
        this.gameOver.set(null);
        this.activePlayerSocketId.set(null);
        this.turnCountdown.set(0);
        this.turnCountdownMax.set(0);
        this.disableEndTurn.set(false);
        this.reachableTiles.set([]);
        this.reachableTilesForTeleport.set([]);
        this.movementPoints.set(0);
        this.actionPoints.set(0);
        this.tileInfo.set(null);
        this.playerPositions.set({});
        this.turnOrder.set([]);
        this.turnNotification.set(null);
        this.inactiveSanctuaries.set([]);
        this.journalEntries.set([]);
        this.isFlagTaken.set(false);
        this.combatLockState.set(null);
        this.gameViewCombatService.resetCombatState();
        this.endGamePlayersSignal.set([]);
        this.endGameStatsSignal.set(null);
    }

    private showNextTurnNotification(endedPlayerSocketId: string): void {
        const message = getNextTurnNotification(this.turnOrder(), this.gameLobby(), endedPlayerSocketId, this.getLocalSocketId());
        if (message) this.turnNotification.set(message);
    }

    private showFirstTurnNotification(order: string[], lobby: Lobby): void {
        const message = getFirstTurnNotification(order, lobby, this.getLocalSocketId());
        if (message) this.turnNotification.set(message);
    }

    setLobby(gameLobby: Lobby | null): void {
        this.gameLobby.set(gameLobby);
    }

    getLocalSocketId(): string | undefined {
        return this.webSocketService.getSocketId(this.namespace);
    }

    isHost(): boolean {
        return this.getLocalSocketId() === this.gameLobby()?.hostSocketId;
    }
}
