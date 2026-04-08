import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { CombatComponent } from '@app/components/combat/combat.component';
import { IsometricMapComponent } from '@app/components/isometric-map/isometric-map.component';
import { JournalComponent } from '@app/components/journal/journal.component';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { OBJECT_PLACEMENT_TOOL } from '@app/constants/map-setup-page-constant';
import { ROUTES } from '@app/constants/routes.constants';
import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS, KEY_TO_DIRECTION } from '@common/direction';
import { GameMode, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';
import {
    TileClickContext,
    buildTileClickContext,
    findPlayerAtPosition,
    getCurrentPlayerIceDebuff,
    getPlayerAvatarById,
    getPlayerNameById,
    getTeamPlayersFromLobby,
    getTimerDisplayFromCountdown,
    getTimerLabelForTurn,
} from './game-page.utils';

const MOVE_COOLDOWN_MS = 150;

@Component({
    selector: 'app-game-page',
    imports: [ButtonComponent, SakuraComponent, ChatComponent, IsometricMapComponent, JournalComponent, CombatComponent],
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
    readonly isCombatStarted = computed(() => this.gameViewService.isCombatStarted());
    readonly fighters = computed(() => this.gameViewService.fighters());

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
        this.getTeamPlayers('A'),
        this.getTeamPlayers('B'),
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

    readonly attackTargets = computed((): Vec2[] => {
        if (!this.isMyTurn()) return [];
        const localId = this.gameViewService.getLocalSocketId();
        const allTeams = this.allTeams();
        return this.adjacentPlayers()
            .filter((player) => {
                const isSameTeam = allTeams.some((team) =>
                    team.some((teammate) => teammate.socketId === localId) &&
                    team.some((teammate) => teammate.socketId === player.socketId),
                );
                return !isSameTeam;
            })
            .map((player) => this.playerPositions()[player.socketId])
            .filter((pos): pos is Vec2 => !!pos);
    });

    readonly requestFlagTargets = computed((): Vec2[] => {
        if (!this.isMyTurn()) return [];
        const localId = this.gameViewService.getLocalSocketId();
        const localPlayer = this.localPlayer();
        if (!localPlayer || localPlayer.hasFlag) return [];

        const allTeams = this.allTeams();
        return this.adjacentPlayers()
            .filter((player) => {
                const isSameTeam = allTeams.some((team) =>
                    team.some((teammate) => teammate.socketId === localId) &&
                    team.some((teammate) => teammate.socketId === player.socketId),
                );
                return isSameTeam && player.hasFlag;
            })
            .map((player) => this.playerPositions()[player.socketId])
            .filter((pos): pos is Vec2 => !!pos);
    });

    readonly giveFlagTargets = computed((): Vec2[] => {
        if (!this.isMyTurn()) return [];
        const localId = this.gameViewService.getLocalSocketId();
        const localPlayer = this.localPlayer();
        if (!localPlayer?.hasFlag) return [];

        const allTeams = this.allTeams();
        return this.adjacentPlayers()
            .filter((player) => allTeams.some((team) =>
                team.some((teammate) => teammate.socketId === localId) &&
                team.some((teammate) => teammate.socketId === player.socketId),
            ))
            .map((player) => this.playerPositions()[player.socketId])
            .filter((pos): pos is Vec2 => !!pos);
    });

    readonly actionHighlightTiles = computed((): ActionTileHighlight[] => {
        const subAction = this.activeSubAction();
        if (!this.isSubMenuOpen() || !subAction) return [];
        const typeMap: Record<ActionHighlightType, Vec2[]> = {
            attack: this.attackTargets(),
            requestFlag: this.requestFlagTargets(),
            giveFlag: this.giveFlagTargets(),
        };
        return (typeMap[subAction] ?? []).map((pos) => ({ pos, type: subAction }));
    });

    readonly hasAnyAction = computed(() =>
        this.isMyTurn() &&
        this.actionPoints() > 0 &&
        (this.attackTargets().length > 0 ||
            this.requestFlagTargets().length > 0 ||
            this.giveFlagTargets().length > 0),
    );

    constructor(
        protected readonly gameViewService: GameViewService,
        private readonly router: Router,
    ) {}

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

    isEndTurnDisabled(): boolean {
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
        const clickContext = this.resolveTileClickContext(x, y);
        if (!action || !clickContext) return;

        switch (action) {
            case 'attack':
                this.handleAttackAction(clickContext.lobbyId, clickContext.currentPlayer, clickContext.targetPlayer, x, y);
                break;
            case 'giveFlag':
                this.gameViewService.giveFlagTransfer(clickContext.lobbyId, clickContext.targetSocketId);
                break;
            case 'requestFlag':
                this.gameViewService.requestFlagTransfer(clickContext.lobbyId, clickContext.targetSocketId);
                break;
        }

        this.closeSubMenu();
    }

    isOnIce(pos: Vec2): 2 | 0 {
        return this.game()?.grid[pos.y][pos.x].type === TileTexture.Ice ? 2 : 0;
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
        return getTeamPlayersFromLobby(this.lobby(), this.orderedPlayers(), team);
    }

    isAdjacentPlayer(col: number, row: number): boolean {
        const playerSocketId = this.getPlayerAtPosition(col, row);
        return !!playerSocketId && this.adjacentPlayers().some((player) => player.socketId === playerSocketId);
    }

    isReachable(col: number, row: number): boolean {
        return this.reachableTiles().some((tile) => tile.x === col && tile.y === row);
    }

    isTeleportable(col: number, row: number): boolean {
        return this.isDebugModeActive() && this.reachableTilesForTeleport().some((tile) => tile.x === col && tile.y === row);
    }

    getPlayerAtPosition(x: number, y: number): string | null {
        return findPlayerAtPosition(this.playerPositions(), x, y);
    }

    getPlayerAvatar(socketId: string): string | undefined {
        return getPlayerAvatarById(this.lobby()?.players ?? [], socketId);
    }

    getPlayerName(socketId: string): string {
        return getPlayerNameById(this.lobby()?.players ?? [], socketId);
    }

    getTimerLabel(): string {
        return getTimerLabelForTurn(this.activePlayerSocketId(), this.gameViewService.getLocalSocketId(), this.lobby()?.players ?? []);
    }

    getTimerDisplay(): string {
        return getTimerDisplayFromCountdown(this.turnCountdown(), this.activePlayerSocketId());
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
