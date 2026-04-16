import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { getFirstTurnNotification, getNextTurnNotification } from '@app/services/game-view/game-view-notification.utils';
import { END_GAME_REDIRECT_DELAY } from '@app/services/game-view/game-view.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Posture } from '@common/character';
import { Direction } from '@common/direction';
import { SanctuaryMode, SocketNamespace } from '@common/enums';
import { GameStats } from '@common/interfaces/game-stats';
import {
    CombatLockStateData,
    GameOverEventData,
    TileInfoData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';

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
    readonly lastCombatRoundResolved = this.gameViewCombatService.lastCombatRoundResolved;
    readonly combatEndPopup = this.gameViewCombatService.combatEndPopup;
    private readonly endGamePlayersSignal = signal<Player[]>([]);
    private readonly endGameStatsSignal = signal<GameStats | null>(null);

    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
        private readonly gameViewCombatService: GameViewCombatService,
    ) {}

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

    sendUseSanctuary(lobbyId: string, position: Vec2, mode: SanctuaryMode): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestUseSanctuary, { lobbyId, position, mode });
    }

    applyFlagPickup(socketId: string, position: Vec2): void {
        this.gameLobby.update((lobby) => {
            if (!lobby) return lobby;
            const updatedGrid = lobby.game.grid.map((row, y) =>
                y === position.y ? row.map((tile, x) => (x === position.x ? { ...tile, item: null } : tile)) : row,
            );
            const updatedPlayers = lobby.players.map((player) => player.socketId === socketId ? { ...player, hasFlag: true } : player);
            return { ...lobby, game: { ...lobby.game, grid: updatedGrid }, players: updatedPlayers };
        });
        this.isFlagTaken.set(true);
    }

    sendTileInfoRequest(lobbyId: string, position: Vec2): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.RequestTileInfo, { lobbyId, position });
    }

    leaveEndGame(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.LeaveEndGame, lobbyId);
    }

    promptFlagTransfer(requesterId: string, requesterName: string, lobbyId: string, isRequest = false): void {
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
                lobbyId, requesterId, accepted: result.isConfirmed, isRequest,
            });
        });
    }

    closePromptIfOpen(): void {
        if (this.closeFlagTransferSwal) {
            this.closeFlagTransferSwal();
            this.closeFlagTransferSwal = null;
        }
    }

    resetGameState(): void {
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

    showNextTurnNotification(endedPlayerSocketId: string): void {
        const message = getNextTurnNotification(this.turnOrder(), this.gameLobby(), endedPlayerSocketId, this.getLocalSocketId());
        if (message) this.turnNotification.set(message);
    }

    showFirstTurnNotification(order: string[], lobby: Lobby): void {
        const message = getFirstTurnNotification(order, lobby, this.getLocalSocketId());
        if (message) this.turnNotification.set(message);
    }

    handleGameOverEvent(data: GameOverEventData): void {
        if (!this.shouldHandleGameOverEvent(data)) return;
        if (data.winnerSocketId !== undefined || data.isForfeit !== undefined || data.abandonTeam !== undefined) {
            this.gameOver.set(data);
        }
        if (data.players) this.endGamePlayersSignal.set(data.players);
        if (data.gameStats) this.endGameStatsSignal.set(data.gameStats);
        setTimeout(() => {
            const destination = data.isForfeit || data.abandonTeam ? ROUTES.home : ROUTES.endGame;
            this.router.navigate([destination]);
        }, END_GAME_REDIRECT_DELAY);
    }

    private shouldHandleGameOverEvent(data: GameOverEventData): boolean {
        const localSocketId = this.getLocalSocketId();
        if (!localSocketId) return false;
        if (data.players && data.players.length > 0) {
            return data.players.some((player) => player.socketId === localSocketId);
        }
        const lobbyPlayers = this.gameLobby()?.players;
        return lobbyPlayers ? lobbyPlayers.some((player) => player.socketId === localSocketId) : true;
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
