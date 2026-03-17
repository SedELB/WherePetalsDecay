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

export interface PlayerMovedData {
    socketId: string;
    position: Vec2;
    movementPoints: number;
}

export interface GameStartedData {
    lobby: Lobby;
    turnOrder: string[];
    playerPositions: Record<string, Vec2>;
}

export interface TileInfoData {
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
    readonly tileInfo = signal<TileInfoData | null>(null);
    readonly gameOver = signal<{ winnerSocketId: string | null; isForfeit?: boolean } | null>(null);

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
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnStarted, (playerSocketId) => {
            this.activePlayerSocketId.set(playerSocketId);
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.TurnCountdown, (secondsLeft) => {
            this.turnCountdown.set(secondsLeft);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnEnded, () => {
            this.activePlayerSocketId.set(null);
            this.reachableTiles.set([]);
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
    private resetGameState(): void {
        this.gameOver.set(null);
        this.activePlayerSocketId.set(null);
        this.turnCountdown.set(0);
        this.reachableTiles.set([]);
        this.movementPoints.set(0);
        this.tileInfo.set(null);
        this.playerPositions.set({});
        this.turnOrder.set([]);
    }

    setLobby(gameLobby: Lobby | null): void {
        this.gameLobby.set(gameLobby);
    }

    getLocalSocketId(): string | undefined {
        return this.webSocketService.getSocketId(this.namespace);
    }
}
