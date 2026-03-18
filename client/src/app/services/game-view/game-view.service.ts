import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Direction } from '@common/direction';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

interface PlayerMovedData {
    socketId: string;
    position: Vec2;
    movementPoints: number;
}

interface GameStartedData {
    lobby: Lobby;
    turnOrder: string[];
    playerPositions: Record<string, Vec2>;
}

interface TileInfoData {
    tile: Tile;
    cost: number;
    player: { name: string; avatar: string } | null;
}

@Injectable({
    providedIn: 'root',
})
export class GameViewService {
    private readonly namespace = SocketNamespace.Join;

    readonly gameLobby = signal<Lobby | null>(null);
    readonly playerPositions = signal<Record<string, Vec2>>({});
    readonly turnOrder = signal<string[]>([]);
    readonly activePlayerSocketId = signal<string | null>(null);
    readonly turnCountdown = signal<number>(0);
    readonly reachableTiles = signal<Vec2[]>([]);
    readonly movementPoints = signal<number>(0);
    readonly actionPoints = signal<number>(0);
    readonly tileInfo = signal<TileInfoData | null>(null);
    readonly gameOver = signal<{ winnerSocketId: string | null; isForfeit?: boolean } | null>(null);
    readonly turnNotification = signal<string | null>(null);

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
            this.showFirstTurnNotification(data.turnOrder, data.lobby);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnStarted, (playerSocketId) => {
            this.activePlayerSocketId.set(playerSocketId);
            this.turnNotification.set(null);
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.TurnCountdown, (secondsLeft) => {
            this.turnCountdown.set(secondsLeft);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnEnded, (endedPlayerSocketId) => {
            this.activePlayerSocketId.set(null);
            this.reachableTiles.set([]);
            this.showNextTurnNotification(endedPlayerSocketId);
        });

        this.webSocketService.onNamespace<PlayerMovedData>(this.namespace, JoinGameEvents.PlayerMoved, (data) => {
            this.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));
            if (data.socketId === this.getLocalSocketId()) {
                this.movementPoints.set(data.movementPoints);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(this.namespace, JoinGameEvents.ReachableTiles, (data) => {
            if (data.socketId === this.getLocalSocketId()) {
                this.reachableTiles.set(data.tiles);
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
            <{ winnerId: string; loserId: string; damage: number; loserHpLeft: number; killed: boolean; loserNewPosition: Vec2 | null }>
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

        this.webSocketService.onNamespace<{ winnerSocketId: string | null; isForfeit?: boolean }>(this.namespace, JoinGameEvents.GameOver, (data) => {
            this.gameOver.set(data);
        });

        this.webSocketService.onNamespace<TileInfoData>(this.namespace, JoinGameEvents.TileInfo, (data) => {
            this.tileInfo.set(data);
        });
    }

    // Emit
    sendMove(lobbyId: string, direction: Direction): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestMove, { lobbyId, direction });
    }

    sendEndTurn(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.EndTurn, lobbyId);
    }

    sendAbandon(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.PlayerAbandon, lobbyId);
    }

    sendCombat(lobbyId: string, targetSocketId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestCombat, { lobbyId, targetSocketId });
    }

    sendTileInfoRequest(lobbyId: string, position: Vec2): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestTileInfo, { lobbyId, position });
    }

    // Utils
    resetGameState(): void {
        this.gameOver.set(null);
        this.activePlayerSocketId.set(null);
        this.turnCountdown.set(0);
        this.reachableTiles.set([]);
        this.movementPoints.set(0);
        this.actionPoints.set(0);
        this.tileInfo.set(null);
        this.playerPositions.set({});
        this.turnOrder.set([]);
        this.turnNotification.set(null);
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
}
