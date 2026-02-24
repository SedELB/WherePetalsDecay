import { Injectable } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { BehaviorSubject } from 'rxjs';

export enum JoinGameEvents {
    GameHosted = 'gameHosted',
    GameFull = 'gameFull',
    GameDeleted = 'gameDeleted',
}

@Injectable({
    providedIn: 'root',
})

export class JoinGameService {
    private readonly namespace = SocketNamespace.Join;
    private readonly gamesSubject = new BehaviorSubject<Game[]>([]);

    readonly games$ = this.gamesSubject.asObservable();

    constructor(
        private readonly webSocketService: WebSocketService,
    ) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace<Game>(this.namespace, JoinGameEvents.GameHosted, (game) => {
            const games = this.gamesSubject.value;
            this.setGames([...games, game]);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.GameFull, (updatedGameId) => {
            const games = this.gamesSubject.value.filter(game => game._id !== updatedGameId);
            this.setGames(games);
        });

        this.webSocketService.onNamespace<string>(this.namespace, JoinGameEvents.GameDeleted, (gameId) => {
            const games = this.gamesSubject.value.filter((game) => game._id !== gameId);
            this.setGames(games);
        });
    }

    setGames(games: Game[]): void {
        this.gamesSubject.next(games);
    }

}
