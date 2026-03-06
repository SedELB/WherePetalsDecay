import { Player } from './player';
import { Game } from './game'

export interface Lobby {
    lobbyId: string,
    gameId: string,
    game: Game,
    hostSocketId: string,
    playerCount: number,
    isLocked: boolean,
    players: Player[],
    pendingAvatars: Record<string, string>,
};


