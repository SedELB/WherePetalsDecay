import { Player } from '@common/player';
import { Server } from 'socket.io';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';

export type StartVirtualPlayerCombat = (lobbyId: string, attackerId: string, defenderId: string) => void;
export type OnGameEnded = (lobbyId: string, winnerId: string) => void;

export interface TurnContext {
    server: Server;
    game: ActiveGame;
    virtualPlayer: Player;
    lobbyId: string;
    startCombat: StartVirtualPlayerCombat;
    onGameEnded: OnGameEnded;
    continueDecisionCycle: () => void;
}
