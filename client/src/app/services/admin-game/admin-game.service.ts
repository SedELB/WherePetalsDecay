import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { AdminGameEvents } from '@common/socket-events/admin.gateway.events';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class AdminGameService {
    private readonly namespace = SocketNamespace.Admin;
    private readonly gamesSubject = new BehaviorSubject<Game[]>([]);

    readonly games$ = this.gamesSubject.asObservable();

    constructor(
        private readonly http: HttpClient,
        private readonly webSocketService: WebSocketService,
    ) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace<Game>(this.namespace, AdminGameEvents.GameCreated, (game) => {
            const games = this.gamesSubject.value;
            this.setGames([...games, game]);
        });

        this.webSocketService.onNamespace<Game>(this.namespace, AdminGameEvents.GameUpdated, (updatedGame) => {
            const games = this.gamesSubject.value.map((game) =>
                game._id === updatedGame._id ? updatedGame : game,
            );
            this.setGames(games);
        });

        this.webSocketService.onNamespace<string>(this.namespace, AdminGameEvents.GameDeleted, (gameId) => {
            const games = this.gamesSubject.value.filter((game) => game._id !== gameId);
            this.setGames(games);
        });

        this.webSocketService.onNamespace<{ gameId: string; isVisible: boolean }>(
            this.namespace,
            AdminGameEvents.GameVisibilityChanged,
            (data) => {
                this.applyVisibilityChange(data.gameId, data.isVisible);
            },
        );
    }

    applyVisibilityChange(gameId: string, isVisible: boolean): void {
        const games = this.gamesSubject.value.map((game) =>
            game._id === gameId ? { ...game, isVisible } : game,
        );
        this.setGames(games);
    }

    setGames(games: Game[]): void {
        this.gamesSubject.next(games);
    }

    fetchAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${environment.serverUrl}/game/allGames`);
    }
}
