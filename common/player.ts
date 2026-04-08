import { Character } from './character';

export interface Player {
    socketId: string;
    character: Character;
    winsCount: number;
    isHost: boolean;
    hasAbandonned: boolean;
    hasFlag: boolean;
    onIceTile?: boolean;
    combatCount: number;
    lossCount: number;
    totalHpLost: number;
    totalHpDealt: number;
    visitedTilesCount: number;
}
