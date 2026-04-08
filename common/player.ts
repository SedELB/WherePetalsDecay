import { Character } from './character';
import { PlayerType, VirtualPlayerProfile } from './enums';

export interface Player {
    socketId: string;
    character: Character;
    isHost: boolean;
    winsCount: number;
    hasAbandonned: boolean;
    playerType: PlayerType;
    virtualProfile?: VirtualPlayerProfile;
}
