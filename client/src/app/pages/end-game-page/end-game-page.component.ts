import { Component, OnDestroy, computed, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { JournalComponent } from '@app/components/journal/journal.component';
import { ROUTES } from '@app/constants/routes.constants';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { SortColumn } from '@app/interfaces/page.interfaces';
import { PERCENT } from '@common/constants/game-stats.constants';
import { GameStats } from '@common/interfaces/game-stats';
import { Player } from '@common/player';

@Component({
    selector: 'app-end-game-page',
    standalone: true,
    imports: [ButtonComponent, ChatComponent, JournalComponent],
    templateUrl: './end-game-page.component.html',
    styleUrl: './end-game-page.component.scss',
})
export class EndGamePageComponent implements OnDestroy, OnInit {
    isJournalOpen = false;

    sortColumn = signal<SortColumn>('winsCount');
    sortAscending = signal<boolean>(false);

    readonly players = computed(() => this.gameViewService.endGamePlayers());
    readonly gameStats = computed(() => this.gameViewService.endGameStats());
    readonly lobby = computed(() => this.gameViewService.gameLobby());
    readonly gameOver = computed(() => this.gameViewService.gameOver());

    readonly localPlayer = computed(() => {
        const localId = this.gameViewService.getLocalSocketId();
        return this.players().find((p) => p.socketId === localId) ?? null;
    });

    readonly sortedPlayers = computed(() => {
        const col = this.sortColumn();
        const asc = this.sortAscending();
        const totalTerrain = this.gameStats()?.totalTerrainTiles ?? 1;

        return [...this.players()].sort((player1, player2) => {
            let valA: number | string;
            let valB: number | string;

            if (col === 'name') {
                valA = player1.character.name.toLowerCase();
                valB = player2.character.name.toLowerCase();
            } else if (col === 'visitedTilesPercent') {
                valA = totalTerrain > 0 ? player1.visitedTilesCount / totalTerrain : 0;
                valB = totalTerrain > 0 ? player2.visitedTilesCount / totalTerrain : 0;
            } else {
                valA = player1[col] ?? 0;
                valB = player2[col] ?? 0;
            }

            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;

            if (col !== 'name') {
                const nameA = player1.character.name.toLowerCase();
                const nameB = player2.character.name.toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
            }

            return 0;
        });
    });

    constructor(
        private readonly router: Router,
        readonly gameViewService: GameViewService,
    ) {}

    ngOnInit(){
        if (this.players().length === 0){
            this.router.navigate([ROUTES.home]);
        }
    }

    ngOnDestroy(): void {
        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) {
            this.gameViewService.leaveEndGame(lobbyId);
        }
    }

    onSort(col: SortColumn): void {
        if (this.sortColumn() === col) {
            this.sortAscending.update((v) => !v);
        } else {
            this.sortColumn.set(col);
            this.sortAscending.set(false);
        }
    }

    sortIndicator(col: SortColumn): string {
        if (this.sortColumn() !== col) return '';
        return this.sortAscending() ? ' ▲' : ' ▼';
    }

    isActiveSort(col: SortColumn): boolean {
        return this.sortColumn() === col;
    }

    visitedPercent(player: Player): string {
        const total = this.gameStats()?.totalTerrainTiles ?? 0;
        if (total === 0) return '0%';
        return `${((player.visitedTilesCount / total) * PERCENT).toFixed(1)}%`;
    }

    formatDuration(seconds: number): string {
        const TEN = 10;
        const SIXTY = 60;
        const m = Math.floor(seconds / SIXTY);
        const s = seconds % SIXTY;
        return `${m < TEN ? '0' : ''}${m}:${s < TEN ? '0' : ''}${s}`;
    }

    formatPercent(value: number): string {
        return `${value.toFixed(1)}%`;
    }

    getWinnerName(): string {
        const winnerId = this.gameOver()?.winnerSocketId;
        if (!winnerId) return '';
        return this.players().find((p) => p.socketId === winnerId)?.character?.name ?? '';
    }

    isWinner(player: Player): boolean {
        return player.socketId === this.gameOver()?.winnerSocketId;
    }

    isMe(player: Player): boolean {
        return player.socketId === this.gameViewService.getLocalSocketId();
    }

    onReturnHome(): void {
        this.router.navigate([ROUTES.home]);
    }

    get stats(): GameStats | null {
        return this.gameStats();
    }
}
