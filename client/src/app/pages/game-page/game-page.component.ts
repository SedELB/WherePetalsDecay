import { Component, HostListener, OnInit, computed, effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { CharacterSheetComponent } from '@app/components/character-sheet/character-sheet.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { CombatComponent } from '@app/components/combat/combat.component';
import { GameOverOverlayComponent } from '@app/components/game-over-overlay/game-over-overlay.component';
import { IsometricMapComponent } from '@app/components/isometric-map/isometric-map.component';
import { JournalComponent } from '@app/components/journal/journal.component';
import { PlayersListComponent } from '@app/components/players-list/players-list.component';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { SanctuaryModalComponent } from '@app/components/sanctuary-modal/sanctuary-modal.component';
import { OBJECT_PLACEMENT_TOOL } from '@app/constants/map-setup-page-constant';
import { ROUTES } from '@app/constants/routes.constants';
import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS, KEY_TO_DIRECTION } from '@common/direction';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';
import { ITEM_NAMES, MOVE_COOLDOWN_MS, TILE_NAMES, TO_PERCENT } from './game-page.constants';
import {
    TileClickContext,
    buildTileClickContext,
    checkHasAnyAction,
    getActionHighlightTiles,
    getAdjacentPlayers,
    getAttackTargets,
    getCurrentPlayerIceDebuff,
    getGiveFlagTargets,
    getOrderedPlayers,
    getRequestFlagTargets,
    getTeamPlayers,
    getPlayerAtPosition as helperGetPlayerAtPosition,
    getPlayerName as helperGetPlayerName,
    getTimerDisplay as helperGetTimerDisplay,
    getTimerLabel as helperGetTimerLabel,
} from './game-page.helper';

@Component({
    selector: 'app-game-page',
    imports: [
        ButtonComponent,
        SakuraComponent,
        ChatComponent,
        IsometricMapComponent,
        JournalComponent,
        CombatComponent,
        PlayersListComponent,
        CharacterSheetComponent,
        SanctuaryModalComponent,
        GameOverOverlayComponent,
    ],
    templateUrl: './game-page.component.html',
    styleUrl: './game-page.component.scss',
})
export class GamePageComponent implements OnInit {
    readonly items = OBJECT_PLACEMENT_TOOL;
    readonly routes = ROUTES;
    readonly costInfinity = Infinity;
    protected gameMode = GameMode;

    readonly tileNames: Record<string, string> = TILE_NAMES;

    readonly itemNames: Record<string, string> = ITEM_NAMES;

    showSanctuaryModal = false;
    pendingSanctuaryPosition: Vec2 | null = null;
    pendingSanctuaryType: TileItem | null = null;

    isChatFocused = false;
    private isMoveCoolingDown = false;
    isJournalOpen = false;
    isLeftPanelOpen = true;
    readonly isSubMenuOpen = signal(false);
    readonly activeSubAction = signal<ActionHighlightType | null>(null);

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
        if (!lockState?.isLocked) return '';

        const attackerName = lockState.attackerSocketId ? this.getPlayerName(lockState.attackerSocketId) : 'Un joueur';
        const defenderName = lockState.defenderSocketId ? this.getPlayerName(lockState.defenderSocketId) : 'Un joueur';
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
    readonly actionHighlightTiles = computed((): ActionTileHighlight[] => getActionHighlightTiles(
        this.isSubMenuOpen(), this.activeSubAction(), this.attackTargets(), this.requestFlagTargets(), this.giveFlagTargets()));
    readonly hasAnyAction = computed(() => checkHasAnyAction(
        this.isMyTurn(), this.actionPoints(), this.attackTargets(), this.requestFlagTargets(), this.giveFlagTargets()));

    constructor(
        protected readonly gameViewService: GameViewService,
        private readonly router: Router,
    ) {
        effect(() => {
            const activeId = this.activePlayerSocketId();
            const localId = this.gameViewService.getLocalSocketId();
            if (activeId !== localId && this.showSanctuaryModal) {
                this.showSanctuaryModal = false;
                this.pendingSanctuaryPosition = null;
                this.pendingSanctuaryType = null;
            }
        });
    }

    ngOnInit(): void {
        if (!this.lobby()) this.router.navigate([this.routes.home]);
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (this.showCombatInProgressModal()) return;

        if (event.key === 'm' || event.key === 'M') {
            if (lobbyId) this.gameViewService.toggleDebugMode(lobbyId);
            return;
        }

        if (!this.isMyTurn() || this.isChatFocused || this.showSanctuaryModal || this.isMoveCoolingDown) return;
        const direction = KEY_TO_DIRECTION[event.key];
        if (!direction) return;

        this.isMoveCoolingDown = true;
        setTimeout(() => (this.isMoveCoolingDown = false), MOVE_COOLDOWN_MS);

        if (lobbyId) this.gameViewService.sendMove(lobbyId, direction);
    }

    onChatFocusChange(focused: boolean): void {
        this.isChatFocused = focused;
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId) return;
        if (this.gameViewService.isHost() && this.isDebugModeActive()) this.gameViewService.toggleDebugMode(lobbyId);
        this.gameViewService.sendAbandonWithoutPrompt(lobbyId);
    }

    isEndTurnDisabled(): boolean {
        if (this.showCombatInProgressModal()) return true;
        return !(this.isMyTurn() || (this.isDebugModeActive() && this.gameViewService.isHost()));
    }

    onEndTurn(): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId) return;
        this.closeSubMenu();
        this.gameViewService.sendEndTurn(lobbyId);
    }

    onAbandon(): void {
        const errorMessage = 'Êtes-vous sûr de vouloir abandonner la partie ? Vous ne pourrez pas revenir dans cette partie si vous quittez.';
        swal.fire({
            title: 'Quitter ?',
            text: errorMessage,
            icon: 'warning',
            confirmButtonText: 'Abandonner',
            cancelButtonText: 'Annuler',
            showCancelButton: true,
        }).then((result) => {
            if (!result.isConfirmed) return;
            const lobbyId = this.lobby()?.lobbyId;
            if (lobbyId) this.gameViewService.sendAbandon(lobbyId);
        });
    }

    toggleSubMenu(): void {
        const next = !this.isSubMenuOpen();
        this.isSubMenuOpen.set(next);
        if (!next) this.activeSubAction.set(null);
    }

    selectSubAction(type: ActionHighlightType): void {
        const current = this.activeSubAction();
        this.activeSubAction.set(current === type ? null : type);
    }

    onTileClick(x: number, y: number): void {
        if (this.showCombatInProgressModal()) return;
        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId || !this.isMyTurn()) return;

        const tile = this.game()?.grid[y]?.[x];
        const isAdjacent = this.isTileAdjacentToPlayer(x, y);

        if (this.tryHandleDoorClick(lobbyId, x, y, tile?.type, isAdjacent)) return;
        if (this.tryHandleSanctuaryClick(x, y, tile?.item as TileItem | null | undefined, isAdjacent)) return;

        this.handleSubActionClick(x, y);
    }

    private handleSubActionClick(x: number, y: number): void {
        const action = this.activeSubAction();
        const clickContext = this.resolveTileClickContext(x, y);
        if (!action || !clickContext) return;

        this.executeTileAction(action, clickContext, x, y);

        this.closeSubMenu();
    }

    isOnIce(pos: Vec2): 2 | 0 {
        return this.game()?.grid[pos.y][pos.x].type === TileTexture.Ice ? 2 : 0;
    }

    private isTileAdjacentToPlayer(col: number, row: number): boolean {
        const localId = this.gameViewService.getLocalSocketId();
        const myPos = localId ? this.playerPositions()[localId] : null;
        if (!myPos) return false;
        return Object.values(DIRECTION_OFFSETS).some((offset) => myPos.x + offset.x === col && myPos.y + offset.y === row);
    }

    private tryHandleDoorClick(lobbyId: string, col: number, row: number, tileType: TileTexture | undefined, isAdjacent: boolean): boolean {
        const isDoor = tileType === TileTexture.DoorClosed || tileType === TileTexture.DoorOpened;
        if (!isDoor || !isAdjacent) return false;
        this.gameViewService.sendToggleDoor(lobbyId, { x: col, y: row });
        return true;
    }

    private tryHandleSanctuaryClick(col: number, row: number, tileItem: TileItem | null | undefined, isAdjacent: boolean): boolean {
        const isSanctuary = tileItem === TileItem.HealingSanctuary || tileItem === TileItem.CombatSanctuary;
        const isInactive = this.inactiveSanctuaries().some((p) => p.x === col && p.y === row);
        if (!isSanctuary || !isAdjacent || isInactive) return false;
        this.pendingSanctuaryPosition = { x: col, y: row };
        this.pendingSanctuaryType = tileItem;
        this.showSanctuaryModal = true;
        return true;
    }

    onUseSanctuary(mode: 'normal' | 'doubleOrNothing'): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId || !this.pendingSanctuaryPosition) return;
        this.gameViewService.sendUseSanctuary(lobbyId, this.pendingSanctuaryPosition, mode);
        this.showSanctuaryModal = false;
        this.pendingSanctuaryPosition = null;
        this.pendingSanctuaryType = null;
    }

    onCancelSanctuary(): void {
        this.showSanctuaryModal = false;
        this.pendingSanctuaryPosition = null;
        this.pendingSanctuaryType = null;
    }

    getSanctuaryLabel(): string {
        return this.pendingSanctuaryType === TileItem.HealingSanctuary ? 'Soin (+2 PV)' : 'Combat (+1 ATK / +1 DEF)';
    }

    onRightClick(event: MouseEvent, position: Vec2): void {
        event.preventDefault();
        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId) return;
        if (this.isDebugModeActive()) {
            this.gameViewService.teleportMove(lobbyId, position);
            return;
        }
        this.gameViewService.sendTileInfoRequest(lobbyId, position);
    }

    isReachable(col: number, row: number): boolean {
        return this.reachableTiles().some((tile) => tile.x === col && tile.y === row);
    }

    isTeleportable(col: number, row: number): boolean {
        return this.isDebugModeActive() && this.reachableTilesForTeleport().some((tile) => tile.x === col && tile.y === row);
    }

    getPlayerAtPosition(x: number, y: number): string | null {
        return helperGetPlayerAtPosition(x, y, this.playerPositions());
    }

    getPlayerName(socketId: string): string {
        return helperGetPlayerName(socketId, this.lobby()?.players ?? []);
    }

    getTimerLabel(): string {
        return helperGetTimerLabel(this.activePlayerSocketId(), this.gameViewService.getLocalSocketId(), this.lobby()?.players ?? []);
    }

    getTimerDisplay(): string {
        return helperGetTimerDisplay(this.turnCountdown(), this.activePlayerSocketId());
    }

    getTurnCountdownProgressPercent(): number {
        const countdownMax = this.gameViewService.turnCountdownMax();
        if (countdownMax <= 0 || !this.activePlayerSocketId()) return 0;

        const progressPercent = (this.turnCountdown() / countdownMax) * TO_PERCENT;
        return Math.min(TO_PERCENT, Math.max(0, progressPercent));
    }

    private handleAttackAction(lobbyId: string, currentPlayer: Player, targetPlayer: Player, x: number, y: number): void {
        targetPlayer.character.debuf = this.isOnIce({ x, y }) ? 2 : 0;
        currentPlayer.character.debuf = getCurrentPlayerIceDebuff(
            this.currentPlayerId(),
            this.playerPositions(),
            (position) => this.isOnIce(position),
        );
        this.gameViewService.sendCombat(lobbyId, currentPlayer, targetPlayer);
    }

    private executeTileAction(action: ActionHighlightType, clickContext: TileClickContext, x: number, y: number): void {
        switch (action) {
            case 'attack':
                this.handleAttackAction(clickContext.lobbyId, clickContext.currentPlayer, clickContext.targetPlayer, x, y);
                return;
            case 'giveFlag':
                this.gameViewService.giveFlagTransfer(clickContext.lobbyId, clickContext.targetSocketId);
                return;
            case 'requestFlag':
                this.gameViewService.requestFlagTransfer(clickContext.lobbyId, clickContext.targetSocketId);
                return;
        }
    }

    private resolveTileClickContext(x: number, y: number): TileClickContext | null {
        if (!this.isSubMenuOpen()) return null;
        const targetSocketId = this.getPlayerAtPosition(x, y);
        const isHighlighted = this.actionHighlightTiles().some((highlightedTile) => highlightedTile.pos.x === x && highlightedTile.pos.y === y);

        return buildTileClickContext({
            lobby: this.lobby(),
            currentSocketId: this.currentPlayerId(),
            actionPoints: this.actionPoints(),
            targetSocketId,
            x,
            y,
            isHighlighted,
        });
    }

    private closeSubMenu(): void {
        this.isSubMenuOpen.set(false);
        this.activeSubAction.set(null);
    }
}
