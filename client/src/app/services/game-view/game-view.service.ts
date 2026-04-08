import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Direction } from '@common/direction';
import { SocketNamespace, TileItem } from '@common/enums';
import { GameStats } from '@common/interfaces/game-stats';
import { CombatResult, GameOverData, GameStartedData, PlayerMovedData, TileInfoData } from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';

const ONE_SECOND_DELAY = 1000;
const END_GAME_REDIRECT_DELAY = 3000;

@Injectable({
    providedIn: 'root',
})
export class GameViewService {
    private readonly namespace = SocketNamespace.Join;

    readonly isDebugModeActive = signal<boolean>(false);
    readonly disableEndTurn = signal<boolean>(false);
    readonly gameLobby = signal<Lobby | null>(null);
    readonly playerPositions = signal<Record<string, Vec2>>({});
    readonly playerStartPositions = signal<Record<string, Vec2>>({});
    readonly turnOrder = signal<string[]>([]);
    readonly activePlayerSocketId = signal<string | null>(null);
    readonly turnCountdown = signal<number>(0);
    readonly reachableTiles = signal<Vec2[]>([]);
    readonly reachableTilesForTeleport = signal<Vec2[]>([]);
    readonly movementPoints = signal<number>(0);
    readonly actionPoints = signal<number>(0);
    readonly tileInfo = signal<TileInfoData | null>(null);
    readonly gameOver = signal<GameOverData | null>(null);
    readonly turnNotification = signal<string | null>(null);
    readonly isFlagTaken = signal<boolean>(false);
    private closeFlagTransferSwal: (() => void) | null = null;
    readonly endGamePlayers = signal<Player[]>([]);
    readonly endGameStats = signal<GameStats | null>(null);

    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
    ) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace(this.namespace, JoinGameEvents.LeftLobby, () => {
            this.setLobby(null);
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
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.BetweenTurnCountdown, (secondsLeft) => {
            this.disableEndTurn.set(true);
            this.turnCountdown.set(secondsLeft);
            if (secondsLeft <= 1) {
                setTimeout(() => {
                    this.disableEndTurn.set(false);
                }, ONE_SECOND_DELAY);
            }
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.TurnCountdown, (secondsLeft) => {
            this.turnCountdown.set(secondsLeft);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnEnded, (endedPlayerSocketId) => {
            this.activePlayerSocketId.set(null);
            this.reachableTiles.set([]);
            this.reachableTilesForTeleport.set([]);
            this.showNextTurnNotification(endedPlayerSocketId);
            // Auto-close pending flag transfer dialog
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
                    const updatedPlayers = lobby.players.map((p) => {
                        if (p.socketId === data.socketId) return { ...p, hasFlag: true };
                        return p;
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
                    const updatedPlayers = lobby.players.map((p) => {
                        if (p.socketId === data.socketId) return { ...p, hasFlag: true };
                        return p;
                    });

                    return { ...lobby, players: updatedPlayers };
                });
                this.isFlagTaken.set(true);
            }
        });

        this.webSocketService.onNamespace<boolean>(this.namespace, JoinGameEvents.DebugToggled, (data) => {
            this.isDebugModeActive.set(data);
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

        this.webSocketService.onNamespace
            <CombatResult>
            (this.namespace, JoinGameEvents.CombatResult, (data) => {
                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const updatedPlayers = lobby.players.map((player) => {
                        if (player.socketId === data.loserId) {
                            return { ...player, character: { ...player.character, life: data.loserHpLeft } };
                        }
                        if (player.socketId === data.winnerId && data.killed) {
                            return { ...player, winsCount: player.winsCount + 1 };
                        }
                        return player;
                    });
                    return { ...lobby, players: updatedPlayers };
                });

                if (data.loserNewPosition) {
                    const newPos = data.loserNewPosition;
                    this.playerPositions.update((positions) => ({ ...positions, [data.loserId]: newPos }));
                }

                if (data.wasFlagDropped) {
                    this.gameLobby.update((lobby) => {
                        if (!lobby) return lobby;
                        lobby.game.grid[data.loserOldPosition.y][data.loserOldPosition.x].item = TileItem.Flag;
                        const updatedPlayers = lobby.players.map((p) => {
                            if (p.socketId === data.loserId) return { ...p, hasFlag: false };
                            return p;
                        });

                        return { ...lobby, players: updatedPlayers };
                    });
                    this.isFlagTaken.set(false);
                }
            });

        this.webSocketService.onNamespace<{ giverPlayerId: string, targetPlayerId: string }>
            (this.namespace, JoinGameEvents.FlagTransferred, (flagTransferData) => {
                const { giverPlayerId, targetPlayerId } = flagTransferData;

                this.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const giver = lobby.players.find(p => p.socketId === giverPlayerId);
                    const taker = lobby.players.find(p => p.socketId === targetPlayerId);
                    if (!giver || !taker) return lobby;
                    taker.hasFlag = true;
                    giver.hasFlag = false;
                    return { ...lobby };
                });
            });

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>
            (this.namespace, JoinGameEvents.GiveFlagResponse, ({ requesterId, requesterName, lobbyId }) => {
                this.closeFlagTransferSwal = () => swal.close();

                swal.fire({
                    title: 'Transfert de drapeau',
                    text: `${requesterName} veut vous passer le drapeau.`,
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
                    });
                });
            });

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            this.namespace, JoinGameEvents.RequestFlagResponse, (requestFlagData) => {
                const {requesterId, requesterName, lobbyId } = requestFlagData;
                
                this.closeFlagTransferSwal = () => swal.close();
                swal.fire({
                    title: 'Transfert de drapeau',
                    text: `${requesterName} veut avoir le drapeau.`,
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
                        isRequest: true,
                    });
                });
            });


        this.webSocketService.onNamespace<{ socketId: string, updatedLobby: Lobby }>(this.namespace, JoinGameEvents.PlayerAbandoned, (payload) => {
            const { socketId, updatedLobby } = payload;
            this.playerPositions.update((positions) => {
                const updated = { ...positions };
                delete updated[socketId];
                return updated;
            });

            this.setLobby(updatedLobby);
        });

        this.webSocketService.onNamespace<GameOverData>(this.namespace, JoinGameEvents.GameOver, (data) => {
            this.gameOver.set(data);
            if (data.players) this.endGamePlayers.set(data.players);
            if (data.gameStats) this.endGameStats.set(data.gameStats);
            setTimeout(() => {
                this.router.navigate([ROUTES.endGame]);
            }, END_GAME_REDIRECT_DELAY);
        });

        this.webSocketService.onNamespace<TileInfoData>(this.namespace, JoinGameEvents.TileInfo, (data) => {
            this.tileInfo.set(data);
        });
    }

    // Emit
    sendMove(lobbyId: string, direction: Direction): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestMove, { lobbyId, direction });
    }

    teleportMove(lobbyId: string, position: Vec2) {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.Teleport, { lobbyId, position });
    }

    toggleDebugMode(lobbyId: string) {
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

    sendCombat(lobbyId: string, targetSocketId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestCombat, { lobbyId, targetSocketId });
    }

    giveFlagTransfer(lobbyId: string, targetSocketId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.GiveFlagRequest, { lobbyId, targetSocketId });
    }

    requestFlagTransfer(lobbyId: string, targetSocketId: string | undefined): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestFlagRequest, { lobbyId, targetSocketId });
    }

    sendTileInfoRequest(lobbyId: string, position: Vec2): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestTileInfo, { lobbyId, position });
    }

    leaveEndGame(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.LeaveEndGame, lobbyId);
    }

    // Utils
    private resetGameState(): void {
        this.isDebugModeActive.set(false);
        this.gameOver.set(null);
        this.activePlayerSocketId.set(null);
        this.turnCountdown.set(0);
        this.disableEndTurn.set(false);
        this.reachableTiles.set([]);
        this.reachableTilesForTeleport.set([]);
        this.movementPoints.set(0);
        this.actionPoints.set(0);
        this.tileInfo.set(null);
        this.playerPositions.set({});
        this.turnOrder.set([]);
        this.turnNotification.set(null);
        this.isFlagTaken.set(false);
    }

    private showNextTurnNotification(endedPlayerSocketId: string): void {
        const order = this.turnOrder();
        const lobby = this.gameLobby();
        if (!lobby || order.length === 0) return;

        const activePlayers = lobby.players.filter((p) => !p.hasAbandonned);
        const endedIndex = order.indexOf(endedPlayerSocketId);
        if (endedIndex === -1) return;

        for (let i = 1; i <= order.length; i++) {
            const candidateId = order[(endedIndex + i) % order.length];
            const candidate = activePlayers.find((p) => p.socketId === candidateId);
            if (candidate) {
                this.setTurnNotificationMessage(candidateId, candidate.character.name);
                return;
            }
        }
    }

    private showFirstTurnNotification(order: string[], lobby: Lobby): void {
        if (order.length === 0 || !lobby.players.length) return;
        const firstPlayer = lobby.players.find((p) => p.socketId === order[0]);
        if (firstPlayer) {
            this.setTurnNotificationMessage(order[0], firstPlayer.character.name);
        }
    }

    private setTurnNotificationMessage(socketId: string, playerName: string): void {
        const isLocal = socketId === this.getLocalSocketId();
        const message = isLocal ? 'C\'est bientôt votre tour !' : `C'est bientôt le tour de ${playerName}`;
        this.turnNotification.set(message);
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
