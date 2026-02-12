import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export enum PlayerGameEvents {
    GameCreated = 'gameCreated',
    GameDeleted = 'gameDeleted',
    GameVisibilityChanged = 'gameVisibilityChanged',
}

@Injectable({
    providedIn: 'root',
})
export class PlayerGameService {
    private readonly namespace = SocketNamespace.Games;
    private readonly gamesSubject = new BehaviorSubject<Game[]>([]);

    readonly visibleGames$ = this.gamesSubject.asObservable();

    constructor(
        private readonly http: HttpClient,
        private readonly webSocketService: WebSocketService,
    ) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace<Game>(this.namespace, PlayerGameEvents.GameCreated, (game) => {
            const games = this.gamesSubject.value;
            this.gamesSubject.next([...games, game]);
        });

        this.webSocketService.onNamespace<string>(this.namespace, PlayerGameEvents.GameDeleted, (gameId) => {
            const games = this.gamesSubject.value.filter((game) => game._id !== gameId);
            this.gamesSubject.next(games);
        });

        this.webSocketService.onNamespace<{ gameId: string; isVisible: boolean }>(
            this.namespace,
            PlayerGameEvents.GameVisibilityChanged,
            (data) => {
                if (data.isVisible) {
                    this.fetchVisibleGames().subscribe({
                        next: (games) => this.setGames(games),
                        error: () => {
                            // Silently handle error
                        },
                    });
                } else {
                    const games = this.gamesSubject.value.filter((game) => game._id !== data.gameId);
                    this.gamesSubject.next(games);
                }
            },
        );
    }

    setGames(games: Game[]): void {
        this.gamesSubject.next(games);
    }

    fetchVisibleGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${environment.serverUrl}/game/visibleGames`);
    }
}
