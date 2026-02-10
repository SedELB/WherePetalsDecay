import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { WebSocketService } from './web-socket.service';
import { Game } from '@app/interfaces/game';

export enum GameEvents {
    GameCreated = 'gameCreated',
    GameUpdated = 'gameUpdated',
    GameDeleted = 'gameDeleted',
    GameVisibilityChanged = 'gameVisibilityChanged',
}

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
            this.applyVisibilityChange(data.gameId, data.isVisible);
        });
    }

    applyVisibilityChange(gameId: string, isVisible: boolean): void {
        const games = this.gamesSubject.value.map((game) =>
            game._id === gameId ? { ...game, isVisible } : game,
        );
        this.gamesSubject.next(games);
    }

    setGames(games: Game[]): void {
        this.gamesSubject.next(games);
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
    
    ngOnDestroy(): void {
        this.disconnect();
    }
}