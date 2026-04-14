import { Injectable, computed, signal } from '@angular/core';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { BASE_STATS } from '@common/constants/character.constants';
import {
    getOrderedPlayers,
    getAdjacentPlayers,
    getTeamPlayers,
    getAttackTargets,
    getRequestFlagTargets,
    getGiveFlagTargets,
    getAdjacentDoorTiles,
    getDoorActionLabel,
    getActionHighlightTiles,
    checkHasAnyAction,
    getPlayerName,
} from './game-page.helper';

@Injectable({
    providedIn: 'root',
})
export class GamePageSignalsService {
    readonly isSubMenuOpen = signal(false);
    readonly activeSubAction = signal<ActionHighlightType | null>(null);
    readonly toggleDoorAction: ActionHighlightType = 'toggleDoor';

    readonly disableEndTurn = computed(() => this.gameViewService.disableEndTurn());
    readonly isDebugModeActive = computed(() => this.gameViewService.isDebugModeActive());
    readonly lobby = computed(() => this.gameViewService.gameLobby());
    readonly game = computed(() => this.lobby()?.game);
    readonly playerPositions = computed(() => this.gameViewService.playerPositions());
    readonly playerStartPositions = computed(() => this.gameViewService.playerStartPositions());
    readonly reachableTiles = computed(() => this.gameViewService.reachableTiles());
    readonly reachableTilesForTeleport = computed(() => this.gameViewService.reachableTilesForTeleport());
    readonly movementPoints = computed(() => this.gameViewService.movementPoints());
    readonly actionPoints = computed(() => this.gameViewService.actionPoints());
    readonly turnCountdown = computed(() => this.gameViewService.turnCountdown());
    readonly activePlayerSocketId = computed(() => this.gameViewService.activePlayerSocketId());
    readonly tileInfo = computed(() => this.gameViewService.tileInfo());
    readonly gameOver = computed(() => this.gameViewService.gameOver());
    readonly turnNotification = computed(() => this.gameViewService.turnNotification());
    readonly currentPlayerId = computed(() => this.gameViewService.getLocalSocketId());
    readonly isFlagTaken = computed(() => this.gameViewService.isFlagTaken());
    readonly isCombatStarted = computed(() => this.gameViewService.isCombatStarted());
    readonly fighters = computed(() => this.gameViewService.fighters());
    readonly combatLockState = computed(() => this.gameViewService.combatLockState());

    readonly isLocalCombatParticipant = computed(() => {
        const localId = this.currentPlayerId();
        if (!localId) return false;
        const fighterData = this.fighters();
        return fighterData.player?.socketId === localId || fighterData.enemy?.socketId === localId;
    });

    readonly isCombatOverlayVisible = computed(() => this.isCombatStarted() && this.isLocalCombatParticipant());

    readonly showCombatInProgressModal = computed(() => {
        const lockState = this.combatLockState();
        const localId = this.currentPlayerId();
        if (!lockState?.isLocked || !localId) return false;
        return localId !== lockState.attackerSocketId && localId !== lockState.defenderSocketId;
    });

    readonly combatInProgressMessage = computed(() => {
        const lockState = this.combatLockState();
        if (!lockState?.isLocked || !this.lobby()) return '';
        const players = this.lobby()?.players ?? [];
        const attackerName = lockState.attackerSocketId ? getPlayerName(lockState.attackerSocketId, players) : 'Un joueur';
        const defenderName = lockState.defenderSocketId ? getPlayerName(lockState.defenderSocketId, players) : 'Un joueur';
        return `${attackerName} affronte ${defenderName}. La partie reprendra à la fin du combat.`;
    });

    readonly orderedPlayers = computed(() =>
        getOrderedPlayers(this.gameViewService.turnOrder(), this.lobby()?.players ?? [], this.activePlayerSocketId()));

    readonly localPlayer = computed(() =>
        this.lobby()?.players.find((player) => player.socketId === this.gameViewService.getLocalSocketId()));

    readonly maxLife = computed(() => {
        const p = this.localPlayer();
        return !p ? BASE_STATS.life : p.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    });

    readonly activePlayer = computed(() =>
        this.lobby()?.players.find((player) => player.socketId === this.activePlayerSocketId()));

    readonly isMyTurn = computed(() => this.activePlayerSocketId() === this.gameViewService.getLocalSocketId());
    readonly inactiveSanctuaries = computed(() => this.gameViewService.inactiveSanctuaries());
    readonly journalEntries = computed(() => this.gameViewService.journalEntries());

    readonly allTeams = computed(() => [
        getTeamPlayers('A', this.lobby(), this.orderedPlayers()),
        getTeamPlayers('B', this.lobby(), this.orderedPlayers()),
    ]);

    readonly adjacentPlayers = computed((): Player[] => getAdjacentPlayers(
        this.isMyTurn(), this.gameViewService.getLocalSocketId(), this.playerPositions(), this.lobby()?.players ?? []));

    readonly attackTargets = computed((): Vec2[] => getAttackTargets(
        this.gameViewService.getLocalSocketId(), this.adjacentPlayers(), this.playerPositions(), this.allTeams()));

    readonly requestFlagTargets = computed((): Vec2[] => getRequestFlagTargets(
        this.localPlayer(), this.adjacentPlayers(), this.playerPositions(), this.allTeams()));

    readonly giveFlagTargets = computed((): Vec2[] => getGiveFlagTargets(
        this.localPlayer(), this.adjacentPlayers(), this.playerPositions(), this.allTeams()));

    readonly adjacentDoorTiles = computed((): Vec2[] => getAdjacentDoorTiles(
        this.isMyTurn(), this.gameViewService.getLocalSocketId(), this.playerPositions(), this.game()?.grid));

    readonly doorActionLabel = computed(() => getDoorActionLabel(this.adjacentDoorTiles(), this.game()?.grid));

    readonly actionHighlightTiles = computed((): ActionTileHighlight[] => getActionHighlightTiles({
        isSubMenuOpen: this.isSubMenuOpen(),
        activeSubAction: this.activeSubAction(),
        attackTargets: this.attackTargets(),
        requestFlagTargets: this.requestFlagTargets(),
        giveFlagTargets: this.giveFlagTargets(),
        adjacentDoorTiles: this.adjacentDoorTiles(),
    }));

    readonly hasAnyAction = computed(() => checkHasAnyAction({
        isMyTurn: this.isMyTurn(),
        actionPoints: this.actionPoints(),
        attackTargets: this.attackTargets(),
        requestFlagTargets: this.requestFlagTargets(),
        giveFlagTargets: this.giveFlagTargets(),
        adjacentDoorTiles: this.adjacentDoorTiles(),
    }));

    constructor(private readonly gameViewService: GameViewService) {}

    toggleSubMenu(): void {
        const next = !this.isSubMenuOpen();
        this.isSubMenuOpen.set(next);
        if (!next) this.activeSubAction.set(null);
    }

    closeSubMenu(): void {
        this.isSubMenuOpen.set(false);
        this.activeSubAction.set(null);
    }

    selectSubAction(type: ActionHighlightType): void {
        const current = this.activeSubAction();
        this.activeSubAction.set(current === type ? null : type);
    }
}
