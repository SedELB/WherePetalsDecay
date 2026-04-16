import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { ONE_SECOND_DELAY } from '@app/services/game-view/game-view.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SanctuaryMode, SocketNamespace, TileItem, TileTexture } from '@common/enums';
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
import swal from 'sweetalert2';
import { GameLogicService } from './game-logic.service';
import { GameViewCombatService } from './game-view-combat.service';
import { GameViewService } from './game-view.service';

@Injectable({
    providedIn: 'root',
})
export class GameViewListenerService {
    private isRegistered = false;
    private readonly namespace = SocketNamespace.Join;

    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
        private readonly gameViewService: GameViewService,
        private readonly gameViewCombatService: GameViewCombatService,
        private readonly gameLogicService: GameLogicService,
    ) {}

    registerListeners(): void {
        if (this.isRegistered) return;
        this.isRegistered = true;
        this.webSocketService.onNamespace(this.namespace, JoinGameEvents.LeftLobby, () => {
            this.gameViewService.setLobby(null);
            this.gameViewService.combatLockState.set(null);
            this.router.navigate([ROUTES.home]);
        });

        this.webSocketService.onNamespace<GameStartedData>(this.namespace, JoinGameEvents.GameStarted, (data) => {
            this.gameViewService.resetGameState();
            this.gameViewService.setLobby(data.lobby);
            this.gameViewService.turnOrder.set(data.turnOrder);
            this.gameViewService.playerPositions.set(data.playerPositions);
            this.gameViewService.playerStartPositions.set(data.playerStartPositions);
            this.gameViewService.showFirstTurnNotification(data.turnOrder, data.lobby);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnStarted, (playerSocketId) => {
            this.gameViewService.activePlayerSocketId.set(playerSocketId);
            this.gameViewService.turnNotification.set(null);
            this.gameViewService.turnCountdownMax.set(0);
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.BetweenTurnCountdown, (secondsLeft) => {
            this.gameViewService.disableEndTurn.set(true);
            this.gameViewService.turnCountdown.set(secondsLeft);
            if (secondsLeft > this.gameViewService.turnCountdownMax()) {
                this.gameViewService.turnCountdownMax.set(secondsLeft);
            }
            if (secondsLeft <= 1) {
                setTimeout(() => {
                    this.gameViewService.disableEndTurn.set(false);
                }, ONE_SECOND_DELAY);
            }
        });

        this.webSocketService.onNamespace<number>(this.namespace, JoinGameEvents.TurnCountdown, (secondsLeft) => {
            this.gameViewService.turnCountdown.set(secondsLeft);
            if (secondsLeft > this.gameViewService.turnCountdownMax()) {
                this.gameViewService.turnCountdownMax.set(secondsLeft);
            }
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.TurnEnded, (endedPlayerSocketId) => {
            this.gameViewService.activePlayerSocketId.set(null);
            this.gameViewService.reachableTiles.set([]);
            this.gameViewService.reachableTilesForTeleport.set([]);
            this.gameViewService.showNextTurnNotification(endedPlayerSocketId);
            this.gameViewService.closePromptIfOpen();
        });

        this.webSocketService.onNamespace<PlayerMovedData>(this.namespace, JoinGameEvents.PlayerMoved, (data) => {
            this.gameViewService.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));
            if (data.socketId === this.gameViewService.getLocalSocketId()) {
                this.gameViewService.movementPoints.set(data.movementPoints);
            }
            if (data.flagTaken) {
                this.gameViewService.gameLobby.update((lobby) => lobby ? this.gameLogicService.applyFlagPickup(lobby, data.socketId) : lobby);
                this.gameViewService.isFlagTaken.set(true);
            }
        });

        this.webSocketService.onNamespace<PlayerMovedData>(this.namespace, JoinGameEvents.PlayerTeleported, (data) => {
            if (!this.gameViewService.isDebugModeActive()) return;
            this.gameViewService.playerPositions.update((positions) => ({ ...positions, [data.socketId]: data.position }));
            if (data.flagTaken) {
                this.gameViewService.applyFlagPickup(data.socketId, data.position);
            }
        });

        this.webSocketService.onNamespace<boolean>(this.namespace, JoinGameEvents.DebugToggled, (isEnabled) => {
            this.gameViewService.isDebugModeActive.set(isEnabled);
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(this.namespace, JoinGameEvents.ReachableTiles, (data) => {
            if (data.socketId === this.gameViewService.getLocalSocketId()) {
                this.gameViewService.reachableTiles.set(data.tiles);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; tiles: Vec2[] }>(
            this.namespace,
            JoinGameEvents.ReachableTilesForTeleport,
            (data) => {
                if (data.socketId === this.gameViewService.getLocalSocketId()) {
                    this.gameViewService.reachableTilesForTeleport.set(data.tiles);
                }
            },
        );

        this.webSocketService.onNamespace<{ socketId: string; movementPoints: number }>(this.namespace, JoinGameEvents.MovementPoints, (data) => {
            if (data.socketId === this.gameViewService.getLocalSocketId()) {
                this.gameViewService.movementPoints.set(data.movementPoints);
            }
        });

        this.webSocketService.onNamespace<{ socketId: string; actionPoints: number }>(this.namespace, JoinGameEvents.ActionPoints, (data) => {
            if (data.socketId === this.gameViewService.getLocalSocketId()) {
                this.gameViewService.actionPoints.set(data.actionPoints);
            }
        });

        this.webSocketService.onNamespace<{ giverPlayerId: string; targetPlayerId: string }>(
            this.namespace,
            JoinGameEvents.FlagTransferred,
            ({ giverPlayerId, targetPlayerId }) => {
                this.gameViewService.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    let updatedLobby = this.gameLogicService.applyFlagPickup(lobby, targetPlayerId);
                    updatedLobby = {
                        ...updatedLobby,
                        players: updatedLobby.players.map((p) => p.socketId === giverPlayerId ? { ...p, hasFlag: false } : p),
                    };
                    return updatedLobby;
                });
            },
        );

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            this.namespace,
            JoinGameEvents.GiveFlagResponse,
            (data) => this.gameViewService.promptFlagTransfer(data.requesterId, data.requesterName, data.lobbyId),
        );

        this.webSocketService.onNamespace<{ requesterId: string; requesterName: string; lobbyId: string }>(
            this.namespace,
            JoinGameEvents.RequestFlagResponse,
            (data) => this.gameViewService.promptFlagTransfer(data.requesterId, data.requesterName, data.lobbyId, true),
        );

        this.webSocketService.onNamespace<{ socketId: string; updatedLobby: Lobby }>(
            this.namespace,
            JoinGameEvents.PlayerAbandoned,
            ({ socketId, updatedLobby }) => {
                this.gameViewService.playerPositions.update((positions) => {
                    const updated = { ...positions };
                    delete updated[socketId];
                    return updated;
                });
                this.gameViewService.gameLobby.update((lobby) => lobby ? this.gameLogicService.removePlayerFromLobby(lobby, socketId) : updatedLobby);
            },
        );

        this.webSocketService.onNamespace<GameOverEventData>(this.namespace, JoinGameEvents.GameOver, (data) => {
            this.gameViewService.handleGameOverEvent(data);
        });

        this.webSocketService.onNamespace<CombatLockStateData>(
            this.namespace,
            JoinGameEvents.CombatLockStateChanged,
            (data) => {
                this.gameViewService.combatLockState.set(data.isLocked ? data : null);
            },
        );

        this.webSocketService.onNamespace<TileInfoData>(this.namespace, JoinGameEvents.TileInfo, (data) => {
            this.gameViewService.tileInfo.set(data);
        });

        this.webSocketService.onNamespace<{ position: Vec2; newType: TileTexture }>(
            this.namespace,
            JoinGameEvents.DoorToggled,
            (data) => {
                this.gameViewService.gameLobby.update((lobby) => lobby ? this.gameLogicService.toggleDoor(lobby, data.position) : lobby);
            },
        );

        this.webSocketService.onNamespace<{ inactiveSanctuaries: Vec2[] }>(
            this.namespace,
            JoinGameEvents.SanctuaryStateUpdate,
            (data) => {
                const expanded = this.gameLogicService.expandSanctuaryPositions(data.inactiveSanctuaries);
                this.gameViewService.inactiveSanctuaries.set(expanded);
            },
        );

        this.webSocketService.onNamespace<{
            socketId: string; sanctuaryType: string; mode: string;
            healAmount: number; combatBonusApplied: boolean;
            playerNewLife: number; playerName: string; inactiveSanctuaries: Vec2[];
        }>(this.namespace, JoinGameEvents.SanctuaryUsed, (data) => {
            const expanded = this.gameLogicService.expandSanctuaryPositions(data.inactiveSanctuaries);
            this.gameViewService.inactiveSanctuaries.set(expanded);
            if (data.healAmount > 0) {
                this.gameViewService.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const playerStats = lobby.players.map((p) =>
                        p.socketId === data.socketId
                            ? { ...p, character: { ...p.character, life: data.playerNewLife } }
                            : p,
                    );
                    return this.gameLogicService.updatePlayerStats(lobby, playerStats);
                });
            }
            this.showSanctuaryResultToast(data);
        });

        this.webSocketService.onNamespace<{ socketId: string; attack: number; defense: number; life: number }>(
            this.namespace,
            JoinGameEvents.PlayerStatsUpdate,
            (data) => {
                this.gameViewService.gameLobby.update((lobby) => {
                    if (!lobby) return lobby;
                    const updatedPlayers = lobby.players.map((p) => {
                        if (p.socketId !== data.socketId) return p;
                        return { ...p, character: { ...p.character, attack: data.attack, defense: data.defense, life: data.life } };
                    });
                    return this.gameLogicService.updatePlayerStats(lobby, updatedPlayers);
                });
            },
        );

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.JournalEntry, (message) => {
            this.gameViewService.journalEntries.update((entries) => [...entries, message]);
        });

        this.gameViewCombatService.setupListeners(this.webSocketService, this.namespace, {
            getLocalSocketId: () => this.gameViewService.getLocalSocketId(),
            getGameLobby: () => this.gameViewService.gameLobby(),
            getPlayerPositions: () => this.gameViewService.playerPositions(),
            updateGameLobby: (updater) => {
                this.gameViewService.gameLobby.update(updater);
            },
            updatePlayerPositions: (updater) => {
                this.gameViewService.playerPositions.update(updater);
            },
            setFlagTaken: (value: boolean) => {
                this.gameViewService.isFlagTaken.set(value);
            },
        });
    }

    private showSanctuaryResultToast(data: {
        playerName: string;
        sanctuaryType: string;
        mode: string;
        healAmount: number;
        combatBonusApplied: boolean;
    }): void {
        const isDoubleOrNothing = data.mode === SanctuaryMode.DoubleOrNothing;
        const isHealing = data.sanctuaryType === TileItem.HealingSanctuary;

        let title: string;
        let text: string;
        let icon: 'success' | 'warning' | 'info';

        if (isHealing) {
            if (data.healAmount > 0) {
                title = isDoubleOrNothing ? 'Double ou rien — Gagné !' : 'Sanctuaire de soin';
                text = `${data.playerName} a récupéré ${data.healAmount} PV`;
                icon = 'success';
            } else {
                title = 'Double ou rien — Raté !';
                text = `${data.playerName} n'a récupéré aucun PV`;
                icon = 'warning';
            }
        } else {
            if (data.combatBonusApplied) {
                title = isDoubleOrNothing ? 'Double ou rien — Gagné !' : 'Sanctuaire de combat';
                text = isDoubleOrNothing
                    ? `${data.playerName} a obtenu un double bonus de combat`
                    : `${data.playerName} a obtenu un bonus de combat`;
                icon = 'success';
            } else {
                title = 'Double ou rien — Raté !';
                text = `${data.playerName} n'a obtenu aucun bonus de combat`;
                icon = 'warning';
            }
        }

        void swal.fire({
            toast: true,
            position: 'top',
            icon,
            title,
            text,
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
        });
    }
}
