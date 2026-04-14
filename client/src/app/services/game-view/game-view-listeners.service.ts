import { Inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { GameViewSignals } from '@app/services/game-view/game-view-signals.interface';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace, TileTexture } from '@common/enums';
import {
    CombatLockStateData,
    GameOverEventData,
    GameStartedData,
    PlayerMovedData,
    TileInfoData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Vec2 } from '@common/vec2';
import { ONE_SECOND_DELAY } from './game-view.constants';

@Injectable({
    providedIn: 'root',
})
export class GameViewListenersService {
    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
        @Inject(GameViewCombatService) private readonly gameViewCombatService: GameViewCombatService,
    ) {}

    registerAll(signals: GameViewSignals): void {
        const ns = signals.namespace;

        this.registerLifecycleListeners(signals, ns);
        this.registerTurnListeners(signals, ns);
        this.registerMovementListeners(signals, ns);
        this.registerFlagListeners(signals, ns);
        this.registerMapInteractionListeners(signals, ns);
        this.registerMiscListeners(signals, ns);
        this.registerCombatListeners(signals, ns);
    }

    private registerLifecycleListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.webSocketService.onNamespace(ns, JoinGameEvents.LeftLobby, () => {
            signals.setLobby(null);
            signals.combatLockState.set(null);
            this.router.navigate([ROUTES.home]);
        });

        this.webSocketService.onNamespace<GameStartedData>(ns, JoinGameEvents.GameStarted, (data) => {
            signals.resetGameState();
            signals.setLobby(data.lobby);
            signals.turnOrder.set(data.turnOrder);
            signals.playerPositions.set(data.playerPositions);
            signals.playerStartPositions.set(data.playerStartPositions);
            signals.showFirstTurnNotification(data.turnOrder, data.lobby);
        });

        this.webSocketService.onNamespace<{ socketId: string; updatedLobby: Lobby }>(ns,
            JoinGameEvents.PlayerAbandoned, ({ socketId, updatedLobby }) => {
                signals.playerPositions.update((positions) => {
                    const updated = { ...positions };
                    delete updated[socketId];
                    return updated;
                });
                signals.setLobby(updatedLobby);
            });

        this.webSocketService.onNamespace<GameOverEventData>(ns, JoinGameEvents.GameOver, (data) => {
            signals.handleGameOverEvent(data);
        });
    }

    private registerTurnListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.webSocketService.onNamespace<string>(ns, JoinGameEvents.TurnStarted, (playerSocketId) => {
            signals.activePlayerSocketId.set(playerSocketId);
            signals.turnNotification.set(null);
        });

        this.webSocketService.onNamespace<number>(ns, JoinGameEvents.BetweenTurnCountdown, (secondsLeft) => {
            signals.disableEndTurn.set(true);
            signals.turnCountdown.set(secondsLeft);
            if (secondsLeft <= 1) {
                setTimeout(() => {
                    signals.disableEndTurn.set(false);
                }, ONE_SECOND_DELAY);
            }
        });

        this.webSocketService.onNamespace<number>(ns, JoinGameEvents.TurnCountdown, (secondsLeft) => {
            signals.turnCountdown.set(secondsLeft);
        });

        this.webSocketService.onNamespace<string>(ns, JoinGameEvents.TurnEnded, (endedPlayerSocketId) => {
            signals.activePlayerSocketId.set(null);
            signals.reachableTiles.set([]);
            signals.reachableTilesForTeleport.set([]);
            signals.showNextTurnNotification(endedPlayerSocketId);
            signals.closeFlagTransferSwalIfOpen();
        });
    }

    private registerMovementListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.webSocketService.onNamespace<PlayerMovedData>(ns, JoinGameEvents.PlayerMoved, (data) => {
            signals.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));
            if (data.socketId === signals.getLocalSocketId()) {
                signals.movementPoints.set(data.movementPoints);
            }

            if (data.flagTaken) {
                this.applyFlagPickup(signals, data.socketId, data.position);
            }
        });

        this.webSocketService.onNamespace<PlayerMovedData>(ns, JoinGameEvents.PlayerTeleported, (data) => {
            if (!signals.isDebugModeActive()) return;
            signals.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));

            if (data.flagTaken) {
                this.applyFlagPickup(signals, data.socketId, data.position);
            }
        });

        this.webSocketService.onNamespace<boolean>(ns, JoinGameEvents.DebugToggled, (isEnabled) => {
            signals.isDebugModeActive.set(isEnabled);
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(ns, JoinGameEvents.ReachableTiles, (data) => {
            if (data.socketId === signals.getLocalSocketId()) {
                signals.reachableTiles.set(data.tiles);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(ns, JoinGameEvents.ReachableTilesForTeleport, (data) => {
            if (data.socketId === signals.getLocalSocketId()) {
                signals.reachableTilesForTeleport.set(data.tiles);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; movementPoints: number }>(ns, JoinGameEvents.MovementPoints, (data) => {
            if (data.socketId === signals.getLocalSocketId()) {
                signals.movementPoints.set(data.movementPoints);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; actionPoints: number }>(ns, JoinGameEvents.ActionPoints, (data) => {
            if (data.socketId === signals.getLocalSocketId()) {
                signals.actionPoints.set(data.actionPoints);
            }
        });
    }

    private registerFlagListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.webSocketService.onNamespace<{ giverPlayerId: string; targetPlayerId: string }>(
            ns,
            JoinGameEvents.FlagTransferred,
            ({ giverPlayerId, targetPlayerId }) => {
                signals.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const hasGiver = lobby.players.some((player) => player.socketId === giverPlayerId);
                    const hasTaker = lobby.players.some((player) => player.socketId === targetPlayerId);
                    if (!hasGiver || !hasTaker) return lobby;

                    const updatedPlayers = lobby.players.map((player) => {
                        if (player.socketId === giverPlayerId) return { ...player, hasFlag: false };
                        if (player.socketId === targetPlayerId) return { ...player, hasFlag: true };
                        return player;
                    });

                    return { ...lobby, players: updatedPlayers };
                });
            },
        );

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            ns,
            JoinGameEvents.GiveFlagResponse,
            ({ requesterId, requesterName, lobbyId }) => signals.promptFlagTransfer(requesterId, requesterName, lobbyId),
        );

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            ns,
            JoinGameEvents.RequestFlagResponse,
            ({ requesterId, requesterName, lobbyId }) => signals.promptFlagTransfer(requesterId, requesterName, lobbyId, true),
        );
    }

    private registerMapInteractionListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.webSocketService.onNamespace<TileInfoData>(ns, JoinGameEvents.TileInfo, (data) => {
            signals.tileInfo.set(data);
        });

        this.webSocketService.onNamespace<{ position: Vec2; newType: TileTexture }>(
            ns, JoinGameEvents.DoorToggled, (data) => {
                signals.gameLobby.update((lobby) => {
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
            ns, JoinGameEvents.SanctuaryStateUpdate, (data) => {
                signals.inactiveSanctuaries.set(signals.expandSanctuaryPositions(data.inactiveSanctuaries));
            },
        );

        this.webSocketService.onNamespace<{
            socketId: string; sanctuaryType: string; mode: string;
            healAmount: number; combatBonusApplied: boolean;
            playerNewLife: number; playerName: string; inactiveSanctuaries: Vec2[];
        }>(ns, JoinGameEvents.SanctuaryUsed, (data) => {
            signals.inactiveSanctuaries.set(signals.expandSanctuaryPositions(data.inactiveSanctuaries));
            if (data.healAmount > 0) {
                signals.gameLobby.update((lobby) => {
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
            ns, JoinGameEvents.PlayerStatsUpdate, (data) => {
                signals.gameLobby.update((lobby) => {
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
    }

    private registerMiscListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.webSocketService.onNamespace<CombatLockStateData>(
            ns,
            JoinGameEvents.CombatLockStateChanged,
            (data) => signals.combatLockState.set(data.isLocked ? data : null),
        );

        this.webSocketService.onNamespace<string>(ns, JoinGameEvents.JournalEntry, (message) => {
            signals.journalEntries.update((entries) => [...entries, message]);
        });
    }

    private registerCombatListeners(signals: GameViewSignals, ns: SocketNamespace): void {
        this.gameViewCombatService.setupListeners(this.webSocketService, ns, {
            getLocalSocketId: () => signals.getLocalSocketId(),
            getGameLobby: () => signals.gameLobby(),
            updateGameLobby: (updater: (lobby: Lobby | null) => Lobby | null) => signals.gameLobby.update(updater),
            updatePlayerPositions: (updater: (positions: Record<string, Vec2>) => Record<string, Vec2>) =>
                signals.playerPositions.update(updater),
            setFlagTaken: (value: boolean) => signals.isFlagTaken.set(value),
        });
    }

    private applyFlagPickup(signals: GameViewSignals, socketId: string, position: Vec2): void {
        signals.gameLobby.update((lobby) => {
            if (!lobby) return lobby;

            const targetRow = lobby.game.grid[position.y];
            if (!targetRow || !targetRow[position.x]) return lobby;

            const updatedGrid = lobby.game.grid.map((row, y) =>
                y === position.y
                    ? row.map((tile, x) => (x === position.x ? { ...tile, item: null } : tile))
                    : row,
            );

            const updatedPlayers = lobby.players.map((player) => {
                if (player.socketId === socketId) return { ...player, hasFlag: true };
                return player;
            });

            return { ...lobby, game: { ...lobby.game, grid: updatedGrid }, players: updatedPlayers };
        });
        signals.isFlagTaken.set(true);
    }
}
