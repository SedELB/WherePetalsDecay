import { Character } from './character';

export interface Player {
    socketId: string;
    character: Character;
    isHost: boolean;
    winsCount: number;
    hasAbandonned: boolean;
    combatCount: number;
    lossCount: number;
    totalHpLost: number;
    totalHpDealt: number;
    visitedTilesCount: number;
}
