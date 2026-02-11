import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

type CreateGameDto = Omit<Game, '_id' | 'createdAt' | 'updatedAt' | '__v'>;
@Injectable({
    providedIn: 'root',
})
export class CommunicationService {

    private readonly baseUrl: string = environment.serverUrl;

    constructor(private readonly http: HttpClient) {}

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/game/games`);
    }

    getVisibleGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/game/visibleGames`);
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/game/${id}`);
    }

    getGameById(id: string) {
        return this.http.get<Game>(`${this.baseUrl}/game/singleGame/${id}`);
    }

    updateVisiblity(game: Game): Observable<void> {
        return this.http.patch<void>(`${this.baseUrl}/game/modifyVisibility/${game._id}`, { isVisible: !game.isVisible });
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

    modifyGame(game: Game): Observable<void> {
        const dto: Partial<CreateGameDto> = {
            name: game.name,
            description: game.description,
            size: game.size,
            gameMode: game.gameMode,
            thumbnail: game.thumbnail,
            maxPlayers: game.maxPlayers,
            grid: game.grid,
            isVisible: game.isVisible,
        };
        return this.http.patch<void>(`${this.baseUrl}/game/modifyGame/${game._id}`, dto, {
            responseType: 'text' as 'json',
        });
    }

}