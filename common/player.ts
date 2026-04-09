import { Character } from './character';
import { PlayerType, VirtualPlayerProfile } from './enums';

export interface Player {
    socketId: string;
    character: Character;
    winsCount: number;
    isHost: boolean;
    hasAbandonned: boolean;
    playerType: PlayerType;
    virtualProfile?: VirtualPlayerProfile;
    hasFlag: boolean;
    onIceTile?: boolean;
    combatCount: number;
    lossCount: number;
    totalHpLost: number;
    totalHpDealt: number;
    visitedTilesCount: number;
}
