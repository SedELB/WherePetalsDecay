import { Component, HostListener, OnInit, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/constants/map-setup-page-constant';
import { ROUTES } from '@app/constants/routes.constants';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS, KEY_TO_DIRECTION } from '@common/direction';
import { GameMode } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';

const GAME_OVER_REDIRECT_DELAY = 3000;

@Component({
    selector: 'app-game-page',
    imports: [ButtonComponent, SakuraComponent, ChatComponent],
    templateUrl: './game-page.component.html',
    styleUrl: './game-page.component.scss',
})
export class GamePageComponent implements OnInit {
    readonly items = OBJECT_PLACEMENT_TOOL;
    readonly tiles = TILE_TOOLS;
    readonly routes = ROUTES;
    readonly costInfinity = Infinity;

    isChatFocused = false;

    protected gameMode = GameMode;

    readonly lobby = computed(() => this.gameViewService.gameLobby());
    readonly game = computed(() => this.lobby()?.game);
    readonly playerPositions = computed(() => this.gameViewService.playerPositions());
    readonly reachableTiles = computed(() => this.gameViewService.reachableTiles());
    readonly movementPoints = computed(() => this.gameViewService.movementPoints());
    readonly turnCountdown = computed(() => this.gameViewService.turnCountdown());
    readonly activePlayerSocketId = computed(() => this.gameViewService.activePlayerSocketId());
    readonly tileInfo = computed(() => this.gameViewService.tileInfo());
    readonly gameOver = computed(() => this.gameViewService.gameOver());

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

    private gameOverTimeout: ReturnType<typeof setTimeout> | null = null;

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
    }

    ngOnInit(): void {
        if (!this.lobby()) {
            this.router.navigate([this.routes.home]);
        }
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        if (!this.isMyTurn() || this.isChatFocused) return;
        const direction = KEY_TO_DIRECTION[event.key];
        if (!direction) return;

        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendMove(lobbyId, direction);
    }

    onChatFocusChange(focused: boolean): void {
        this.isChatFocused = focused;
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        this.onAbandon();
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

    onCombat(targetSocketId: string): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendCombat(lobbyId, targetSocketId);
    }

    onRightClick(event: MouseEvent, position: Vec2): void {
        event.preventDefault();
        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendTileInfoRequest(lobbyId, position);
    }

    isReachable(col: number, row: number): boolean {
        return this.reachableTiles().some((t) => t.x === col && t.y === row);
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
