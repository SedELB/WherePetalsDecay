import { Character } from './character';

export interface Player {
    socketId: string;
    character: Character;
    winsCount: number;
    isHost: boolean;
    hasAbandonned: boolean;
    hasFlag: boolean;
}
