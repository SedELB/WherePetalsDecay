import { Component, HostListener, OnInit, effect, signal } from '@angular/core';
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
import { ActionHighlightType } from '@app/interfaces/isometric-interfaces';
import { ITEM_NAMES, MOVE_COOLDOWN_MS, TILE_NAMES, TO_PERCENT } from '@app/pages/game-page/game-page.constants';
import { GameLogicService, TileClickContext } from '@app/services/game-view/game-logic.service';
import { GameViewListenerService } from '@app/services/game-view/game-view-listener.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { KEY_TO_DIRECTION } from '@common/direction';
import { GameMode, PlayerAction, SanctuaryMode, TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal, { SweetAlertIcon } from 'sweetalert2';
import { GamePageSignalsService } from './game-page-signals.service';

const MESSAGE_ERROR = 'Êtes-vous sûr de vouloir abandonner la partie ? Vous ne pourrez pas revenir dans cette partie si vous quittez.';

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
    providers: [GamePageSignalsService],
})
export class GamePageComponent implements OnInit {
    readonly signals = this.gamePageSignalsService;

    readonly items = OBJECT_PLACEMENT_TOOL;
    readonly routes = ROUTES;
    protected gameMode = GameMode;
    protected readonly playerAction = PlayerAction;
    readonly tileNames: Record<string, string> = TILE_NAMES;
    readonly itemNames: Record<string, string> = ITEM_NAMES;
    readonly costInfinity = Infinity;

    showSanctuaryModal = false;
    pendingSanctuaryPosition: Vec2 | null = null;
    pendingSanctuaryType: TileItem | null = null;
    isChatFocused = false;
    isJournalOpen = false;
    isLeftPanelOpen = true;
    readonly pressedDirectionKey = signal<'W' | 'A' | 'S' | 'D' | null>(null);

    private isMoveCoolingDown = false;
    private wasAutoCollapseActive = false;

    constructor(
        protected readonly gameViewService: GameViewService,
        private readonly gamePageSignalsService: GamePageSignalsService,
        private readonly router: Router,
        private readonly gameViewListenerService: GameViewListenerService,
        private readonly gameLogicService: GameLogicService,
    ) {
        effect(() => {
            const shouldAutoCollapse = this.signals.shouldCollapseGameInfo();
            if (shouldAutoCollapse && !this.wasAutoCollapseActive) this.isLeftPanelOpen = false;
            this.wasAutoCollapseActive = shouldAutoCollapse;
        });

        effect(() => {
            const activeId = this.signals.activePlayerSocketId();
            const localId = this.gameViewService.getLocalSocketId();
            if (activeId !== localId && this.showSanctuaryModal) this.onCancelSanctuary();
        });
    }

    ngOnInit(): void {
        this.gameViewListenerService.registerListeners();
        if (!this.signals.lobby()) this.router.navigate([this.routes.home]);
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        if (this.signals.showCombatInProgressModal()) return;
        if (!this.canHandleMovementInput()) return;

        const direction = KEY_TO_DIRECTION[event.key];
        if (!direction) return;

        this.pressedDirectionKey.set(direction);
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        const lobbyId = this.signals.lobby()?.lobbyId;
        const direction = KEY_TO_DIRECTION[event.key];
        if (direction) this.pressedDirectionKey.set(null);

        if (this.signals.showCombatInProgressModal()) return;

        if ((event.key === 'm' || event.key === 'M') && this.gameViewService.isHost()) {
            if (lobbyId) this.gameViewService.toggleDebugMode(lobbyId);
            return;
        }

        if (!this.canHandleMovementInput()) return;
        if (!direction) return;

        this.isMoveCoolingDown = true;
        setTimeout(() => (this.isMoveCoolingDown = false), MOVE_COOLDOWN_MS);
        this.signals.closeSubMenu();
        if (lobbyId) this.gameViewService.sendMove(lobbyId, direction);
    }

    @HostListener('window:blur')
    onWindowBlur(): void {
        this.pressedDirectionKey.set(null);
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        const lobbyId = this.signals.lobby()?.lobbyId;
        if (!lobbyId) return;
        if (this.gameViewService.isHost() && this.signals.isDebugModeActive()) this.gameViewService.toggleDebugMode(lobbyId);
        this.gameViewService.sendAbandonWithoutPrompt(lobbyId);
    }

    onChatFocusChange(focused: boolean): void {
        this.isChatFocused = focused;
    }

    onEndTurn(): void {
        if (this.signals.isCombatOverlayVisible()) return;
        const lobbyId = this.signals.lobby()?.lobbyId;
        if (lobbyId) {
            this.signals.closeSubMenu();
            this.gameViewService.sendEndTurn(lobbyId);
        }
    }

    onAbandon(): void {
        if (this.signals.isLocalCombatParticipant()) {
            this.showErrorToast('Impossible de quitter', 'Vous ne pouvez pas abandonner la partie pendant un combat !');
            return;
        }
        swal.fire({
            title: 'Quitter ?',
            text: MESSAGE_ERROR,
            icon: 'warning',
            confirmButtonText: 'Abandonner',
            cancelButtonText: 'Annuler',
            showCancelButton: true,
        }).then((result) => {
            if (result.isConfirmed) {
                const lobbyId = this.signals.lobby()?.lobbyId;
                if (lobbyId) this.gameViewService.sendAbandon(lobbyId);
            }
        });
    }

    onTileClick(x: number, y: number): void {
        if (this.signals.showCombatInProgressModal()) return;
        const lobbyId = this.signals.lobby()?.lobbyId;
        if (!lobbyId || !this.signals.isMyTurn()) return;

        const action = this.signals.activeSubAction();
        const context = this.resolveClickContext(x, y);
        if (action && context) {
            this.executeAction(action, context, x, y);
            this.signals.closeSubMenu();
        }
    }

    onRightClick(event: MouseEvent, pos: Vec2): void {
        event.preventDefault();
        const lobbyId = this.signals.lobby()?.lobbyId;
        if (!lobbyId || !this.signals.isMyTurn() || this.gameViewService.disableEndTurn()) return;

        if (this.signals.isDebugModeActive() && this.isTeleportable(pos.x, pos.y)) {
            this.signals.closeSubMenu();
            this.gameViewService.teleportMove(lobbyId, pos);
        } else {
            this.gameViewService.sendTileInfoRequest(lobbyId, pos);
        }
    }

    onSelectSanctuaryAction(): void {
        this.signals.selectSubAction(PlayerAction.Sanctuary);
    }

    onUseSanctuary(mode: SanctuaryMode): void {
        const lobbyId = this.signals.lobby()?.lobbyId;
        if (lobbyId && this.pendingSanctuaryPosition) {
            this.gameViewService.sendUseSanctuary(lobbyId, this.pendingSanctuaryPosition, mode);
            this.showToast('Sanctuaire utilisé !', 'success');
            this.onCancelSanctuary();
        }
    }

    onCancelSanctuary(): void {
        this.showSanctuaryModal = false;
        this.pendingSanctuaryPosition = null;
        this.pendingSanctuaryType = null;
    }

    getSanctuaryLabel(): string {
        return this.pendingSanctuaryType === TileItem.HealingSanctuary ? 'Soin (+2 PV)' : 'Combat (+1 ATK / +1 DEF)';
    }

    private resolveClickContext(x: number, y: number) {
        return this.gameLogicService.buildTileClickContext({
            lobby: this.signals.lobby(),
            currentSocketId: this.signals.currentPlayerId(),
            actionPoints: this.signals.actionPoints(),
            targetSocketId: this.gameLogicService.getPlayerAtPosition(x, y, this.signals.playerPositions()),
            x,
            y,
            isHighlighted: this.signals.actionHighlightTiles().some((h) => h.pos.x === x && h.pos.y === y),
        });
    }

    private executeAction(action: ActionHighlightType, ctx: TileClickContext, x: number, y: number): void {
        const lobbyId = ctx.lobbyId;
        switch (action) {
            case PlayerAction.Attack:
                if (ctx.targetPlayer) {
                    ctx.targetPlayer.character.debuf = this.isOnIce({ x, y }) ? 2 : 0;
                    ctx.currentPlayer.character.debuf = this.gameLogicService.getCurrentPlayerIceDebuff(
                        this.signals.currentPlayerId(),
                        this.signals.playerPositions(),
                        (p) => this.isOnIce(p),
                    );
                    this.gameViewService.sendCombat(lobbyId, ctx.currentPlayer, ctx.targetPlayer);
                }
                break;
            case PlayerAction.GiveFlag:
                if (ctx.targetSocketId) this.gameViewService.giveFlagTransfer(lobbyId, ctx.targetSocketId);
                break;
            case PlayerAction.RequestFlag:
                if (ctx.targetSocketId) this.gameViewService.requestFlagTransfer(lobbyId, ctx.targetSocketId);
                break;
            case PlayerAction.ToggleDoor:
                this.gameViewService.sendToggleDoor(lobbyId, { x, y });
                this.showToast('Porte interagie !', 'success');
                break;
            case PlayerAction.Sanctuary:
                this.handleSanctuaryAction(x, y);
                break;
        }
    }

    private handleSanctuaryAction(x: number, y: number): void {
        const grid = this.signals.game()?.grid;
        if (!grid) return;

        const tileItem = grid[y]?.[x].item;
        if (!tileItem) return;
        const result = this.gameLogicService.getSanctuaryCanonicalInfo(
            { x, y },
            {
                item: tileItem,
                grid,
                currentSocketId: this.signals.currentPlayerId(),
                positions: this.signals.playerPositions(),
            },
        );

        if (!result.isAdjacent) return this.showToast('Trop loin !', 'warning');
        this.pendingSanctuaryPosition = result.canonicalPos;
        this.pendingSanctuaryType = tileItem;
        this.showSanctuaryModal = true;
    }

    isEndTurnDisabled(): boolean {
        if (this.signals.isCombatOverlayVisible() || this.signals.showCombatInProgressModal()) return true;
        return !(this.signals.isMyTurn() || (this.signals.isDebugModeActive() && this.gameViewService.isHost()));
    }

    isActionButtonDisabled(): boolean {
        return this.signals.isCombatOverlayVisible() || !this.signals.hasAnyAction();
    }

    getPlayerName(socketId: string): string {
        return this.gameLogicService.getPlayerName(socketId, this.signals.lobby()?.players ?? []);
    }

    getTimerLabel(): string {
        const socketId = this.gameViewService.getLocalSocketId();
        return this.gameLogicService.getTimerLabel(this.signals.activePlayerSocketId(), socketId, this.signals.lobby()?.players ?? []);
    }
    getTimerDisplay(): string {
        return this.gameLogicService.getTimerDisplay(this.signals.turnCountdown(), this.signals.activePlayerSocketId());
    }

    getTimerActivePlayer(): Player | undefined {
        return this.signals.lobby()?.players.find((p) => p.socketId === this.signals.activePlayerSocketId());
    }

    hasTimerActivePlayer(): boolean {
        return Boolean(this.signals.activePlayerSocketId());
    }

    getTurnCountdownProgressPercent(): number {
        const max = this.gameViewService.turnCountdownMax();
        return max > 0 ? (this.signals.turnCountdown() / max) * TO_PERCENT : 0;
    }

    shouldCollapseGameInfo(): boolean {
        return this.signals.shouldCollapseGameInfo();
    }

    isDebugModeActive(): boolean {
        return this.signals.isDebugModeActive();
    }

    private isOnIce(pos: Vec2): 2 | 0 {
        return this.signals.game()?.grid[pos.y][pos.x].type === TileTexture.Ice ? 2 : 0;
    }

    private isTeleportable(x: number, y: number): boolean {
        return this.signals.isDebugModeActive() && this.signals.reachableTilesForTeleport().some((t) => t.x === x && t.y === y);
    }

    private showErrorToast(title: string, text: string) {
        void swal.fire({ title, text, icon: 'error', confirmButtonText: 'OK' });
    }

    private showToast(title: string, icon: SweetAlertIcon) {
        void swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2000 });
    }

    private canHandleMovementInput(): boolean {
        return this.signals.isMyTurn() && !this.isChatFocused && !this.showSanctuaryModal && !this.isMoveCoolingDown;
    }
}

