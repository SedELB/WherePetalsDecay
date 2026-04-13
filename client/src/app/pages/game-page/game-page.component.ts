/* eslint-disable*/
import { Component, HostListener, OnInit, computed, effect, signal } from '@angular/core';
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
import { GameMode, TileItem, TileTexture } from '@common/enums';
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
const GAME_OVER_REDIRECT_DELAY = 5000;

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

    showSanctuaryModal = false;
    pendingSanctuaryPosition: Vec2 | null = null;
    pendingSanctuaryType: TileItem | null = null;

    isChatFocused = false;
    private gameOverTimeout: ReturnType<typeof setTimeout> | null = null;
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
    readonly inactiveSanctuaries = computed(() => this.gameViewService.inactiveSanctuaries());
    readonly journalEntries = computed(() => this.gameViewService.journalEntries());

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
            toggleDoor: this.adjacentDoorTiles(),
        };
        return (typeMap[subAction] ?? []).map((pos) => ({ pos, type: subAction }));
    });

    readonly hasAnyAction = computed(() => {
        if (!this.isMyTurn() || this.actionPoints() <= 0) return false;
        const hasTargets = this.attackTargets().length > 0 ||
            this.requestFlagTargets().length > 0 ||
            this.giveFlagTargets().length > 0;
        if (hasTargets) return true;
        return this.adjacentDoorTiles().length > 0;
    });

    readonly adjacentDoorTiles = computed((): Vec2[] => {
        if (!this.isMyTurn()) return [];
        const localId = this.gameViewService.getLocalSocketId();
        const myPos = localId ? this.playerPositions()[localId] : null;
        if (!myPos || !this.game()) return [];
        const grid = this.game()!.grid;
        return Object.values(DIRECTION_OFFSETS)
            .map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }))
            .filter(({ x, y }) => {
                const type = grid[y]?.[x]?.type;
                return type === TileTexture.DoorClosed || type === TileTexture.DoorOpened;
            });
    });

    readonly doorActionLabel = computed(() => {
        const tiles = this.adjacentDoorTiles();
        if (tiles.length === 0) return 'Porte';
        const firstDoor = tiles[0];
        const grid = this.game()?.grid;
        if (!grid) return 'Porte';
        const isClosed = grid[firstDoor.y]?.[firstDoor.x]?.type === TileTexture.DoorClosed;
        return isClosed ? 'Ouvrir porte' : 'Fermer porte';
    });

    constructor(
        protected readonly gameViewService: GameViewService,
        private readonly router: Router,
    ) {
        effect(() => {
            const over = this.gameOver();
            if (this.gameOverTimeout) {
                clearTimeout(this.gameOverTimeout);
                this.gameOverTimeout = null;
            }
            if (over) {
                this.gameOverTimeout = setTimeout(() => {
                    this.gameOverTimeout = null;
                    if (this.gameOver()) {
                        this.router.navigate([this.routes.home]);
                    }
                }, GAME_OVER_REDIRECT_DELAY);
            }
        });

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

        const action = this.activeSubAction();
        const clickContext = this.resolveTileClickContext(x, y);

        if (action === 'toggleDoor') {
            const doorType = this.game()?.grid[y]?.[x]?.type;
            const isDoor = doorType === TileTexture.DoorClosed || doorType === TileTexture.DoorOpened;
            if (isDoor && isAdjacent) {
                this.gameViewService.sendToggleDoor(lobbyId, { x, y });
                this.closeSubMenu();
            }
            return;
        }

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
        this.closeSubMenu();
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
        this.closeSubMenu();
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
