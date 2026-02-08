import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';
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
    private readonly apiUrl = environment.serverUrl.replace('/api', '');
    private readonly gamesSubject = new BehaviorSubject<Game[]>([]);
    private socket: Socket | null = null;

    readonly games$ = this.gamesSubject.asObservable();

    constructor(private readonly http: HttpClient) {}

    connect(): void {
        if (this.socket?.connected) {
            return;
        }

        this.socket = io(this.apiUrl, { transports: ['websocket'] });

        this.socket.on(GameEvents.GameCreated, (game: Game) => {
            const games = this.gamesSubject.value;
            this.gamesSubject.next([...games, game]);
        });

        this.socket.on(GameEvents.GameUpdated, (updatedGame: Game) => {
            const games = this.gamesSubject.value.map((game) =>
                game._id === updatedGame._id ? updatedGame : game,
            );
            this.gamesSubject.next(games);
        });

        this.socket.on(GameEvents.GameDeleted, (gameId: string) => {
            const games = this.gamesSubject.value.filter((game) => game._id !== gameId);
            this.gamesSubject.next(games);
        });

        this.socket.on(GameEvents.GameVisibilityChanged, (data: { gameId: string; isVisible: boolean }) => {
            const games = this.gamesSubject.value.map((game) =>
                game._id === data.gameId ? { ...game, isVisible: data.isVisible } : game,
            );
            this.gamesSubject.next(games);
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
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