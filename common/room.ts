import { Player } from './player';

export interface Room {
    code: string;
    gameId: string;     
    gameName: string;
    maxPlayers: number;
    players: Player[];
    isLocked: boolean;
    organizerId: string;    
}

export interface RoomJoinPayload {
    roomCode: string;
    player: Omit<Player, 'id' | 'isOrganizer'>;
}

export interface RoomCreatePayload {
    gameId: string;
    gameName: string;
    maxPlayers: number;
    player: Omit<Player, 'id' | 'isOrganizer'>;
}
