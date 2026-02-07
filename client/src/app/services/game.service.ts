import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { WebSocketService } from './web-socket.service';

export interface Game {
    _id: string;
    name: string;
    description: string;
    size: { rows: number; cols: number };
    gameMode: string;
    thumbnail: string;
    maxPlayers: number;
    isVisible: boolean;
    createdAt: string;
    updatedAt: string;
}

export enum GameEvents {
    GameCreated = 'gameCreated',
    GameUpdated = 'gameUpdated',
    GameDeleted = 'gameDeleted',
    GameVisibilityChanged = 'gameVisibilityChanged',
}

const SMALL_THRESHOLD = 100;
const MEDIUM_THRESHOLD = 225;

@Injectable({
    providedIn: 'root',
})
export class GameService implements OnDestroy {
    private readonly gamesSubject = new BehaviorSubject<Game[]>([]);

    readonly games$ = this.gamesSubject.asObservable();

    constructor(
        private readonly http: HttpClient,
        private readonly webSocketService: WebSocketService,
    ) {}

    connect(): void {
        this.webSocketService.connect();

        this.webSocketService.on<Game>(GameEvents.GameCreated, (game) => {
            const games = this.gamesSubject.value;
            this.gamesSubject.next([...games, game]);
        });

        this.webSocketService.on<Game>(GameEvents.GameUpdated, (updatedGame) => {
            const games = this.gamesSubject.value.map((game) =>
                game._id === updatedGame._id ? updatedGame : game,
            );
            this.gamesSubject.next(games);
        });

        this.webSocketService.on<string>(GameEvents.GameDeleted, (gameId) => {
            const games = this.gamesSubject.value.filter((game) => game._id !== gameId);
            this.gamesSubject.next(games);
        });

        this.webSocketService.on<{ gameId: string; isVisible: boolean }>(GameEvents.GameVisibilityChanged, (data) => {
            const games = this.gamesSubject.value.map((game) =>
                game._id === data.gameId ? { ...game, isVisible: data.isVisible } : game,
            );
            this.gamesSubject.next(games);
        });
    }

    disconnect(): void {
        this.webSocketService.disconnect();
    }

    fetchVisibleGames(): void {
        this.http.get<Game[]>(`${environment.serverUrl}/game/visibleGames`).subscribe({
            next: (games) => this.gamesSubject.next(games),
        });
    }

    getVisibleGames(): Observable<Game[]> {
        return new Observable((observer) => {
            this.games$.subscribe((games) => {
                observer.next(games.filter((game) => game.isVisible));
            });
        });
    }

    getSizeLabel(size: { rows: number; cols: number }): string {
        const total = size.rows * size.cols;

        if (total <= SMALL_THRESHOLD) {
            return `Petite (${size.rows}x${size.cols})`;
        }
        if (total <= MEDIUM_THRESHOLD) {
            return `Moyenne (${size.rows}x${size.cols})`;
        }
        return `Grande (${size.rows}x${size.cols})`;
    }

    ngOnDestroy(): void {
        this.disconnect();
    }
}