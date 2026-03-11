import { Player } from './player';
import { Game } from './game'
import { ChatMessage } from './chat-message';

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
};


