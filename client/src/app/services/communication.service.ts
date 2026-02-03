import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
// import { Message } from '@common/message';
import { Observable } from 'rxjs';
// import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Game } from '@app/interfaces/game';

type CreateGameDto = Omit<Game, '_id' | 'createdAt' | 'updatedAt' | '__v'>;
@Injectable({
    providedIn: 'root',
})
export class CommunicationService {

    private readonly baseUrl: string = environment.serverUrl;

    constructor(private readonly http: HttpClient) {}

    
    // private readonly baseUrl: string = environment.serverUrl;

    // constructor(private readonly http: HttpClient) {}

    // basicGet(): Observable<Message> {
    //     return this.http.get<Message>(`${this.baseUrl}/example`).pipe(catchError(this.handleError<Message>('basicGet')));
    // }

    // basicPost(message: Message): Observable<HttpResponse<string>> {
    //     return this.http.post(`${this.baseUrl}/example/send`, message, { observe: 'response', responseType: 'text' });
    // }

    // private handleError<T>(request: string, result?: T): (error: Error) => Observable<T> {
    //     return () => of(result as T);
    // }

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/game/games`);
    }

    getVisibleGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/game/visibleGames`);
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/game/${id}`);
    }

    updateVisiblity(game: Game): Observable<void> {
        return this.http.patch<void>(`${this.baseUrl}/game/delete/${game._id}`, !game.isVisible);
    }

    createGame(game: Game): Observable<void> {
        const dto: CreateGameDto = {
            name: game.name,
            description: game.description,
            size: game.size,
            gameMode: game.gameMode,
            thumbnail: game.thumbnail,
            maxPlayers: game.maxPlayers,
            grid: game.grid,
            isVisible: game.isVisible,
        };
        return this.http.post<void>(`${this.baseUrl}/game/addGame`, dto);
    }

    // TODO: il manque le modify game

}
