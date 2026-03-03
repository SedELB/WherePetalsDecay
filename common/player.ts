import { Character } from './character';

export interface Player {
    socketId: string;
    character: Character;
    isHost: boolean;
}