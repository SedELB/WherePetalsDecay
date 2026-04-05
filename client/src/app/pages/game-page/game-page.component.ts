import { Component, HostListener, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { IsometricMapComponent } from '@app/components/isometric-map/isometric-map.component';
import { JournalComponent } from '@app/components/journal/journal.component';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { OBJECT_PLACEMENT_TOOL } from '@app/constants/map-setup-page-constant';
import { ROUTES } from '@app/constants/routes.constants';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS, KEY_TO_DIRECTION } from '@common/direction';
import { GameMode } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';

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
    readonly tileNames: Record<string, string> = {
        floor: 'Sol',
        wall: 'Mur',
        water: 'Eau',
        ice: 'Glace',
        doorOpened: 'Porte ouverte',
        doorClosed: 'Porte fermée',
    };

    isChatFocused = false;
    private isMoveCoolingDown = false;
    isJournalOpen = false;
    isCombatMode = false;
    isLeftPanelOpen = true;

    protected gameMode = GameMode;

    readonly disableEndTurn = computed(() => this.gameViewService.disableEndTurn());
    readonly isDebugModeActive = computed(() => this.gameViewService.isDebugModeActive());
    readonly lobby = computed(() => this.gameViewService.gameLobby());
    readonly game = computed(() => this.lobby()?.game);
    readonly playerPositions = computed(() => this.gameViewService.playerPositions());
    readonly reachableTiles = computed(() => this.gameViewService.reachableTiles());
    readonly reachableTilesForTeleport = computed(() => this.gameViewService.reachableTilesForTeleport());
    readonly movementPoints = computed(() => this.gameViewService.movementPoints());
    readonly actionPoints = computed(() => this.gameViewService.actionPoints());
    readonly turnCountdown = computed(() => this.gameViewService.turnCountdown());
    readonly activePlayerSocketId = computed(() => this.gameViewService.activePlayerSocketId());
    readonly tileInfo = computed(() => this.gameViewService.tileInfo());
    readonly gameOver = computed(() => this.gameViewService.gameOver());
    readonly turnNotification = computed(() => this.gameViewService.turnNotification());

    readonly orderedPlayers = computed(() => {
        const order = this.gameViewService.turnOrder();
        const players = this.lobby()?.players ?? [];
        if (order.length === 0) return players;

        const fullList = order
            .map((socketId) => players.find((player) => player.socketId === socketId))
            .filter((player): player is Player => !!player);

        const activeId = this.activePlayerSocketId();
        if (!activeId) return fullList;

        const activeIndex = fullList.findIndex((player) => player.socketId === activeId);
        if (activeIndex <= 0) return fullList;

        return [...fullList.slice(activeIndex), ...fullList.slice(0, activeIndex)];
    });

    readonly localPlayer = computed(() => {
        const localPlayerId = this.gameViewService.getLocalSocketId();
        return this.lobby()?.players.find((player) => player.socketId === localPlayerId);
    });

    readonly maxLife = computed(() => {
        const player = this.localPlayer();
        if (!player) return BASE_STATS.life;
        return player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    });

    readonly activePlayer = computed(() => {
        const activeId = this.activePlayerSocketId();
        return this.lobby()?.players.find((player) => player.socketId === activeId);
    });

    readonly isMyTurn = computed(() => this.activePlayerSocketId() === this.gameViewService.getLocalSocketId());

    readonly adjacentPlayers = computed((): Player[] => {
        if (!this.isMyTurn()) return [];
        const localId = this.gameViewService.getLocalSocketId();
        const positions = this.playerPositions();
        const myPos = localId ? positions[localId] : null;
        if (!myPos) return [];

        const adjacentPositions = Object.values(DIRECTION_OFFSETS).map((offset) => ({
            x: myPos.x + offset.x,
            y: myPos.y + offset.y,
        }));

        return (this.lobby()?.players ?? []).filter((player) => {
            if (player.socketId === localId || player.hasAbandonned) return false;
            const pPos = positions[player.socketId];
            return pPos && adjacentPositions.some((adj) => adj.x === pPos.x && adj.y === pPos.y);
        });
    });

    constructor(
        protected readonly gameViewService: GameViewService,
        private readonly router: Router,
    ) {}


    ngOnInit(): void {
        if (!this.lobby()) {
            this.router.navigate([this.routes.home]);
        }
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
        if (lobbyId) {
            if (this.gameViewService.isHost() && this.isDebugModeActive()) {
                this.gameViewService.toggleDebugMode(lobbyId);
            }
            this.gameViewService.sendAbandonWithoutPrompt(lobbyId);
        }
    }

    isEndTurnDisabled() {
        return !(this.isMyTurn() || (this.isDebugModeActive() && this.gameViewService.isHost()));
    }

    onEndTurn(): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendEndTurn(lobbyId);
    }

    onAbandon(): void {
        const errorMessage = 'Êtes-vous sûr de vouloir abandonner la partie ? Vous ne pourrez pas revenir dans cette partie si vous quittez.';
        swal.fire({
            title: 'Quitter ?',
            text: `${errorMessage}`,
            icon: 'warning',
            confirmButtonText: 'Abandonner',
            cancelButtonText: 'Annuler',
            showCancelButton: true,
        }).then((result) => {
            if (result.isConfirmed) {
                const lobbyId = this.lobby()?.lobbyId;
                if (lobbyId) this.gameViewService.sendAbandon(lobbyId);
            }
        });
    }

    toggleCombatMode(): void {
        this.isCombatMode = !this.isCombatMode;
    }

    onTileClick(col: number, row: number): void {
        if (!this.isCombatMode) return;
        const targetSocketId = this.getPlayerAtPosition(col, row);
        if (!targetSocketId) return;
        const isAdjacent = this.adjacentPlayers().some((p) => p.socketId === targetSocketId);
        if (!isAdjacent) return;

        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendCombat(lobbyId, targetSocketId);
        this.isCombatMode = false;
    }

    onRightClick(event: MouseEvent, position: Vec2): void {
        event.preventDefault();
        const lobbyId = this.lobby()?.lobbyId;
        if (!lobbyId) return;
        if (this.isDebugModeActive()) {
            this.gameViewService.teleportMove(lobbyId, position);
            return;
        }
        if (lobbyId) this.gameViewService.sendTileInfoRequest(lobbyId, position);
    }

    isAdjacentPlayer(col: number, row: number): boolean {
        const playerSocketId = this.getPlayerAtPosition(col, row);
        if (!playerSocketId) return false;
        return this.adjacentPlayers().some((p) => p.socketId === playerSocketId);
    }

    isReachable(col: number, row: number): boolean {
        return this.reachableTiles().some((t) => t.x === col && t.y === row);
    }

    isTeleportable(col: number, row: number): boolean {
        if (!this.isDebugModeActive()) return false;
        return this.reachableTilesForTeleport().some((t) => t.x === col && t.y === row);
    }

    getPlayerAtPosition(col: number, row: number): string | null {
        const positions = this.playerPositions();
        for (const [socketId, pos] of Object.entries(positions)) {
            if (pos.x === col && pos.y === row) return socketId;
        }
        return null;
    }

    getPlayerAvatar(socketId: string): string | undefined {
        return this.lobby()?.players.find((player) => player.socketId === socketId)?.character?.avatar;
    }

    getPlayerName(socketId: string): string {
        return this.lobby()?.players.find((player) => player.socketId === socketId)?.character?.name ?? 'Un joueur';
    }

    getTimerLabel(): string {
        const activeId = this.activePlayerSocketId();
        if (!activeId) {
            return 'Prochain tour...';
        }
        const name = this.getPlayerName(activeId);
        if (activeId === this.gameViewService.getLocalSocketId()) {
            return 'Votre tour';
        }
        return `Tour de ${name}`;
    }

    getTimerDisplay(): string {
        const countdown = this.turnCountdown();
        if (!this.activePlayerSocketId()) {
            return `00:0${countdown}`;
        }
        const TEN = 10;
        return `00:${countdown < TEN ? '0' : ''}${countdown}`;
    }
}
