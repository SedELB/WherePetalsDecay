import { ChatMessage } from './chat-message';
import { Game } from './game';
import { Player } from './player';

export interface Lobby {
    lobbyId: string,
    gameId: string,
    game: Game,
    hostSocketId: string,
    playerCount: number,
    isLocked: boolean,
    players: Player[],
    pendingAvatars: Record<string, string>,
    chatHistory: ChatMessage[],
    teamA: Player[],
    teamB: Player[],
};


