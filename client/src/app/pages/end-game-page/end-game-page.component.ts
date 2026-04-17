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
        const column = this.sortColumn();
        const isAscending = this.sortAscending();

        return [...this.players()].sort((p1, p2) => {
            const result = this.comparePlayersByColumn(p1, p2, column);
            
            if (result !== 0) {
                return isAscending ? result : -result;
            }
            
            const tieBreaker = p1.character.name.localeCompare(p2.character.name);
            return isAscending ? tieBreaker : -tieBreaker;
        });
    });

    private comparePlayersByColumn(p1: Player, p2: Player, column: SortColumn): number {
        if (column === 'name') {
            return p1.character.name.localeCompare(p2.character.name);
        }

        const v1 = this.getNumericValue(p1, column);
        const v2 = this.getNumericValue(p2, column);
        return v1 - v2;
    }

    private getNumericValue(player: Player, column: SortColumn): number {
        if (column === 'visitedTilesPercent') {
            const total = this.gameStats()?.totalTerrainTiles ?? 1;
            return total > 0 ? player.visitedTilesCount / total : 0;
        }

        const stats: Record<string, number> = {
            winsCount: player.winsCount,
            combatCount: player.combatCount,
            lossCount: player.lossCount,
            totalHpLost: player.totalHpLost,
            totalHpDealt: player.totalHpDealt,
        };

        return stats[column] ?? 0;
    }

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
        const FORMAT_THRESHOLD = 10;
        const SECONDS_IN_MIN = 60;
        const m = Math.floor(seconds / SECONDS_IN_MIN);
        const s = seconds % SECONDS_IN_MIN;
        return `${m < FORMAT_THRESHOLD ? '0' : ''}${m}:${s < FORMAT_THRESHOLD ? '0' : ''}${s}`;
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
