import { Game } from './game';
import { GamePlayer } from './game-player';

export type GameStatus = 'waiting' | 'playing' | 'finished';

export const TURN_DURATION = 30;
export const TURN_DELAY = 3;
export const VICTORIES_TO_WIN = 3;

export interface GameSession {
    gameId: string;
    game: Game;
    players: GamePlayer[];
    currentTurnIndex: number;
    turnOrder: string[];
    status: GameStatus;
    winner: string | null;
}
