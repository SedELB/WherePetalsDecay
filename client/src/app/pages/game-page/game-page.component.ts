import { Component, HostListener, OnInit, computed, effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { IsometricMapComponent } from '@app/components/isometric-map/isometric-map.component';
import { JournalComponent } from '@app/components/journal/journal.component';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { OBJECT_PLACEMENT_TOOL } from '@app/constants/map-setup-page-constant';
import { ROUTES } from '@app/constants/routes.constants';
import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS, KEY_TO_DIRECTION } from '@common/direction';
import { GameMode } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';
import {
    getAttackTargets,
    getGiveFlagTargets,
    getPlayerAtPosition,
    getPlayerAvatar,
    getPlayerName,
    getRequestFlagTargets,
    getTeamPlayers,
    getTimerDisplay,
    getTimerLabel,
} from './game-page.helper';

const GAME_OVER_REDIRECT_DELAY = 5000;
const MOVE_COOLDOWN_MS = 150;

@Component({
    selector: 'app-game-page',
    imports: [ButtonComponent, SakuraComponent, ChatComponent, IsometricMapComponent, JournalComponent],
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

    readonly orderedPlayers = computed(() => {
        const order = this.gameViewService.turnOrder();
        const players = this.lobby()?.players ?? [];
        if (!order.length) return players;

        const fullList = order
            .map((socketId) => players.find((player) => player.socketId === socketId))
            .filter((player): player is Player => !!player);

        const activeId = this.activePlayerSocketId();
        if (!activeId) return fullList;

        const activeIndex = fullList.findIndex((player) => player.socketId === activeId);
        return activeIndex <= 0 ? fullList : [...fullList.slice(activeIndex), ...fullList.slice(0, activeIndex)];
    });

    readonly localPlayer = computed(() => {
        const localId = this.gameViewService.getLocalSocketId();
        return this.lobby()?.players.find((player) => player.socketId === localId);
    });

    readonly maxLife = computed(() => {
        const player = this.localPlayer();
        return !player ? BASE_STATS.life : player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    });

    readonly activePlayer = computed(() => {
        const activeId = this.activePlayerSocketId();
        return this.lobby()?.players.find((player) => player.socketId === activeId);
    });

    readonly isMyTurn = computed(() => this.activePlayerSocketId() === this.gameViewService.getLocalSocketId());

    readonly allTeams = computed(() => [
        getTeamPlayers('A', this.lobby(), this.orderedPlayers()),
        getTeamPlayers('B', this.lobby(), this.orderedPlayers()),
    ]);

    readonly adjacentPlayers = computed((): Player[] => {
        if (!this.isMyTurn()) return [];
        const localId = this.gameViewService.getLocalSocketId();
        const positions = this.playerPositions();
        const myPos = localId ? positions[localId] : null;
        if (!myPos) return [];

        const adjacent = Object.values(DIRECTION_OFFSETS).map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }));
        return (this.lobby()?.players ?? []).filter((player) => {
            if (player.socketId === localId || player.hasAbandonned) return false;
            const pos = positions[player.socketId];
            return !!pos && adjacent.some((a) => a.x === pos.x && a.y === pos.y);
        });
    });

    readonly attackTargets = computed((): Vec2[] =>
        !this.isMyTurn() ? [] : getAttackTargets(this.gameViewService.getLocalSocketId(),
        this.adjacentPlayers(), 
        this.playerPositions(), 
        this.allTeams()),
    );

    readonly requestFlagTargets = computed((): Vec2[] =>
        !this.isMyTurn() ? [] : getRequestFlagTargets(this.localPlayer(), this.adjacentPlayers(), this.playerPositions(), this.allTeams()),
    );

    readonly giveFlagTargets = computed((): Vec2[] =>
        !this.isMyTurn() ? [] : getGiveFlagTargets(this.localPlayer(), this.adjacentPlayers(), this.playerPositions(), this.allTeams()),
    );

    readonly actionHighlightTiles = computed((): ActionTileHighlight[] => {
        const action = this.activeSubAction();
        if (!this.isSubMenuOpen() || !action) return [];
        const map: Record<ActionHighlightType, Vec2[]> = {
            attack: this.attackTargets(),
            requestFlag: this.requestFlagTargets(),
            giveFlag: this.giveFlagTargets(),
        };
        return (map[action] ?? []).map((pos) => ({ pos, type: action }));
    });

    readonly hasAnyAction = computed(() =>
        this.isMyTurn() &&
        this.actionPoints() > 0 &&
        (this.attackTargets().length > 0 || this.requestFlagTargets().length > 0 || this.giveFlagTargets().length > 0),
    );

    private gameOverTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(
        protected readonly gameViewService: GameViewService,
        private readonly router: Router,
    ) {
        effect(() => {
            if (this.gameOverTimeout) {
                clearTimeout(this.gameOverTimeout);
                this.gameOverTimeout = null;
            }
            if (!this.gameOver()) return;

                this.gameOverTimeout = setTimeout(() => {
                    this.gameOverTimeout = null;
                    if (this.gameOver()) this.router.navigate([this.routes.endGame]);
                }, GAME_OVER_REDIRECT_DELAY);
        });
    }

    ngOnInit(): void {
        if (!this.lobby()) this.router.navigate([this.routes.home]);
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (event.key === 'm' || event.key === 'M') {
            if (lobbyId) this.gameViewService.toggleDebugMode(lobbyId);
            return;
        }

        if (!this.isMyTurn() || this.isChatFocused || this.isMoveCoolingDown) return;
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

    isEndTurnDisabled(): boolean  {
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
        const action = this.activeSubAction();
        if (!this.isSubMenuOpen() || !action) return;

        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId || this.actionPoints() <= 0) return;

        const targetSocketId = this.getPlayerAtPosition(x, y);
        if (!targetSocketId || targetSocketId === this.currentPlayerId()) return;

        const isHighlighted = this.actionHighlightTiles().some((h) => h.pos.x === x && h.pos.y === y);
        if (!isHighlighted) return;

        switch (action) {
            case 'attack':
                this.gameViewService.sendCombat(lobbyId, targetSocketId);
                break;
            case 'giveFlag':
                this.gameViewService.giveFlagTransfer(lobbyId, targetSocketId);
                break;
            case 'requestFlag':
                this.gameViewService.requestFlagTransfer(lobbyId, targetSocketId);
                break;
        }

        this.closeSubMenu();
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

    getTeamPlayers(team: 'A' | 'B'): Player[] {
        return getTeamPlayers(team, this.lobby(), this.orderedPlayers());
    }

    isAdjacentPlayer(col: number, row: number): boolean {
        const playerSocketId = this.getPlayerAtPosition(col, row);
        return !!playerSocketId && this.adjacentPlayers().some((p) => p.socketId === playerSocketId);
    }

    isReachable(col: number, row: number): boolean {
        return this.reachableTiles().some((t) => t.x === col && t.y === row);
    }

    isTeleportable(col: number, row: number): boolean {
        return this.isDebugModeActive() && this.reachableTilesForTeleport().some((t) => t.x === col && t.y === row);
    }

    getPlayerAtPosition(x: number, y: number): string | null {
        return getPlayerAtPosition(x, y, this.playerPositions());
    }

    getPlayerAvatar(socketId: string): string | undefined {
        return getPlayerAvatar(socketId, this.lobby()?.players ?? []);
    }

    getPlayerName(socketId: string): string {
        return getPlayerName(socketId, this.lobby()?.players ?? []);
    }

    getTimerLabel(): string {
        return getTimerLabel(this.activePlayerSocketId() ?? null, this.gameViewService.getLocalSocketId() ?? null, this.lobby()?.players ?? []);
    }

    getTimerDisplay(): string {
        return getTimerDisplay(this.turnCountdown(), this.activePlayerSocketId() ?? null);
    }

    private closeSubMenu(): void {
        this.isSubMenuOpen.set(false);
        this.activeSubAction.set(null);
    }
}