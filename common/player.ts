import { Character } from './character';

export interface Player {
    socketId: string;
    character: Character;
    winsCount: number;
    flagsCaptured: number;
    isHost: boolean;
    hasAbandonned: boolean;
    hasFlag: boolean;
}
