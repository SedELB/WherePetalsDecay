import { Component, HostListener, OnInit, effect } from '@angular/core';
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
import { GameViewService } from '@app/services/game-view/game-view.service';
import { DIRECTION_OFFSETS, KEY_TO_DIRECTION } from '@common/direction';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal, { SweetAlertResult } from 'sweetalert2';
import { GamePageSignalsService } from './game-page-signals.service';
import {
    TileClickContext,
    buildTileClickContext,
    getCurrentPlayerIceDebuff,
    getPlayerAtPosition as helperGetPlayerAtPosition,
    getPlayerName as helperGetPlayerName,
    getTimerDisplay as helperGetTimerDisplay,
    getTimerLabel as helperGetTimerLabel,
} from './game-page.helper';

const MOVE_COOLDOWN_MS = 150;

@Component({
    selector: 'app-game-page',
    standalone: true,
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

    readonly tileNames: Record<string, string> = {
        floor: 'Sol',
        wall: 'Mur',
        water: 'Eau',
        ice: 'Glace',
        doorOpened: 'Porte ouverte',
        doorClosed: 'Porte fermée',
    };

    readonly itemNames: Record<string, string> = {
        spawn: 'Point de départ',
        flag: 'Drapeau',
        healingSanctuary: 'Sanctuaire de soin',
        combatSanctuary: 'Sanctuaire de combat',
    };

    showSanctuaryModal = false;
    pendingSanctuaryPosition: Vec2 | null = null;
    pendingSanctuaryType: TileItem | null = null;

    isChatFocused = false;
    private isMoveCoolingDown = false;
    isJournalOpen = false;
    isLeftPanelOpen = true;

    constructor(
        readonly gameViewService: GameViewService,
        readonly gamePageSignalService: GamePageSignalsService,
        private readonly router: Router,
    ) {
        effect(() => {
            const activeId = this.gameViewService.activePlayerSocketId();
            const localId = this.gameViewService.getLocalSocketId();
            if (activeId !== localId && this.showSanctuaryModal) {
                this.showSanctuaryModal = false;
                this.pendingSanctuaryPosition = null;
                this.pendingSanctuaryType = null;
            }
        });
    }

    ngOnInit(): void {
        if (!this.gamePageSignalService.lobby()) this.router.navigate([this.routes.home]);
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
        if (this.gamePageSignalService.showCombatInProgressModal()) return;

        if (event.key === 'm' || event.key === 'M') {
            if (lobbyId) this.gameViewService.toggleDebugMode(lobbyId);
            return;
        }

        if (!this.gamePageSignalService.isMyTurn() || this.isChatFocused || this.showSanctuaryModal || this.isMoveCoolingDown) return;
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
        const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
        if (!lobbyId) return;
        if (this.gameViewService.isHost() && this.gamePageSignalService.isDebugModeActive()) this.gameViewService.toggleDebugMode(lobbyId);
        this.gameViewService.sendAbandonWithoutPrompt(lobbyId);
    }

    isEndTurnDisabled(): boolean {
        if (this.gamePageSignalService.showCombatInProgressModal()) return true;
        return !(this.gamePageSignalService.isMyTurn() || (this.gamePageSignalService.isDebugModeActive() && this.gameViewService.isHost()));
    }

    onEndTurn(): void {
        const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
        if (!lobbyId) return;
        this.gamePageSignalService.closeSubMenu();
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
        }).then((result: SweetAlertResult) => {
            if (!result.isConfirmed) return;
            const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
            if (lobbyId) this.gameViewService.sendAbandon(lobbyId);
        });
    }


    onSelectSanctuaryAction(): void {
        const targets = this.gamePageSignalService.sanctuaryTargets();
        if (targets.length === 1) {
            const pos = targets[0];
            const tileItem = this.gamePageSignalService.game()?.grid[pos.y]?.[pos.x]?.item as TileItem | null | undefined;
            if (tileItem === TileItem.HealingSanctuary || tileItem === TileItem.CombatSanctuary) {
                this.pendingSanctuaryPosition = pos;
                this.pendingSanctuaryType = tileItem;
                this.showSanctuaryModal = true;
                this.gamePageSignalService.closeSubMenu();
                return;
            }
        }
        this.gamePageSignalService.selectSubAction('sanctuary');
    }

    onTileClick(x: number, y: number): void {
        if (this.gamePageSignalService.showCombatInProgressModal()) return;
        const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
        if (!lobbyId || !this.gamePageSignalService.isMyTurn()) return;

        const tile = this.gamePageSignalService.game()?.grid[y]?.[x];
        const isAdjacent = this.isTileAdjacentToPlayer(x, y);

        if (this.tryHandleDoorClick(lobbyId, x, y, tile?.type, isAdjacent)) return;

        this.handleSubActionClick(x, y, lobbyId, isAdjacent);
    }

    private handleSubActionClick(x: number, y: number, lobbyId: string, isAdjacent: boolean): void {
        const action = this.gamePageSignalService.activeSubAction();

        if (action === 'sanctuary') {
            this.handleSanctuarySubAction(x, y);
            return;
        }

        if (action === 'toggleDoor') {
            const doorType = this.gamePageSignalService.game()?.grid[y]?.[x]?.type;
            const isDoor = doorType === TileTexture.DoorClosed || doorType === TileTexture.DoorOpened;
            if (isDoor && isAdjacent) {
                this.gameViewService.sendToggleDoor(lobbyId, { x, y });
                this.gamePageSignalService.closeSubMenu();
            }
            return;
        }

        const clickContext = this.resolveTileClickContext(x, y);
        if (!action || !clickContext) return;

        if (action === 'attack') {
            this.handleAttackAction(clickContext.lobbyId, clickContext.currentPlayer, clickContext.targetPlayer, x, y);
        } else if (action === 'giveFlag') {
            this.gameViewService.giveFlagTransfer(clickContext.lobbyId, clickContext.targetSocketId);
        } else if (action === 'requestFlag') {
            this.gameViewService.requestFlagTransfer(clickContext.lobbyId, clickContext.targetSocketId);
        }

        this.gamePageSignalService.closeSubMenu();
    }

    private handleSanctuarySubAction(x: number, y: number): void {
        const isHighlighted = this.gamePageSignalService.actionHighlightTiles().some(
            (t) => t.pos.x === x && t.pos.y === y && t.type === 'sanctuary');
        if (!isHighlighted) return;

        const tileItem = this.gamePageSignalService.game()?.grid[y]?.[x]?.item as TileItem | null | undefined;
        const isSanctuary = tileItem === TileItem.HealingSanctuary || tileItem === TileItem.CombatSanctuary;
        if (!isSanctuary) return;

        this.pendingSanctuaryPosition = { x, y };
        this.pendingSanctuaryType = tileItem;
        this.showSanctuaryModal = true;
        this.gamePageSignalService.closeSubMenu();
    }

    isOnIce(pos: Vec2): 2 | 0 {
        return this.gamePageSignalService.game()?.grid[pos.y][pos.x].type === TileTexture.Ice ? 2 : 0;
    }

    private isTileAdjacentToPlayer(col: number, row: number): boolean {
        const localId = this.gameViewService.getLocalSocketId();
        const myPos = localId ? this.gamePageSignalService.playerPositions()[localId] : null;
        if (!myPos) return false;
        return Object.values(DIRECTION_OFFSETS).some((offset) => myPos.x + offset.x === col && myPos.y + offset.y === row);
    }

    private tryHandleDoorClick(lobbyId: string, col: number, row: number, tileType: TileTexture | undefined, isAdjacent: boolean): boolean {
        const isDoor = tileType === TileTexture.DoorClosed || tileType === TileTexture.DoorOpened;
        if (!isDoor || !isAdjacent) return false;
        this.gameViewService.sendToggleDoor(lobbyId, { x: col, y: row });
        this.gamePageSignalService.closeSubMenu();
        return true;
    }
    onUseSanctuary(mode: 'normal' | 'doubleOrNothing'): void {
        const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
        if (!lobbyId || !this.pendingSanctuaryPosition) return;
        this.gameViewService.sendUseSanctuary(lobbyId, this.pendingSanctuaryPosition, mode);
        this.showSanctuaryModal = false;
        this.gamePageSignalService.closeSubMenu();
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
        const lobbyId = this.gamePageSignalService.lobby()?.lobbyId;
        if (!lobbyId) return;
        if (this.gamePageSignalService.isDebugModeActive()) {
            this.gameViewService.teleportMove(lobbyId, position);
            return;
        }
        this.gameViewService.sendTileInfoRequest(lobbyId, position);
    }

    isReachable(col: number, row: number): boolean {
        return this.gamePageSignalService.reachableTiles().some((tile) => tile.x === col && tile.y === row);
    }

    isTeleportable(col: number, row: number): boolean {
        return this.gamePageSignalService.isDebugModeActive()
            && this.gamePageSignalService.reachableTilesForTeleport().some((tile) => tile.x === col && tile.y === row);
    }

    getPlayerAtPosition(x: number, y: number): string | null {
        return helperGetPlayerAtPosition(x, y, this.gamePageSignalService.playerPositions());
    }

    getPlayerName(socketId: string): string {
        return helperGetPlayerName(socketId, this.gamePageSignalService.lobby()?.players ?? []);
    }

    getTimerLabel(): string {
        return helperGetTimerLabel(this.gamePageSignalService.activePlayerSocketId(),
            this.gameViewService.getLocalSocketId(),
            this.gamePageSignalService.lobby()?.players ?? []);
    }

    getTimerDisplay(): string {
        return helperGetTimerDisplay(this.gamePageSignalService.turnCountdown(), this.gamePageSignalService.activePlayerSocketId());
    }

    private handleAttackAction(lobbyId: string, currentPlayer: Player, targetPlayer: Player, x: number, y: number): void {
        targetPlayer.character.debuf = this.isOnIce({ x, y }) ? 2 : 0;
        currentPlayer.character.debuf = getCurrentPlayerIceDebuff(
            this.gamePageSignalService.currentPlayerId(),
            this.gamePageSignalService.playerPositions(),
            (position) => this.isOnIce(position),
        );
        this.gameViewService.sendCombat(lobbyId, currentPlayer, targetPlayer);
    }

    private resolveTileClickContext(x: number, y: number): TileClickContext | null {
        if (!this.gamePageSignalService.isSubMenuOpen()) return null;
        const targetSocketId = this.getPlayerAtPosition(x, y);
        const isHighlighted = this.gamePageSignalService.actionHighlightTiles().some(
            (highlightedTile) => highlightedTile.pos.x === x && highlightedTile.pos.y === y,
        );

        return buildTileClickContext({
            lobby: this.gamePageSignalService.lobby(),
            currentSocketId: this.gamePageSignalService.currentPlayerId(),
            actionPoints: this.gamePageSignalService.actionPoints(),
            targetSocketId,
            x,
            y,
            isHighlighted,
        });
    }
}
