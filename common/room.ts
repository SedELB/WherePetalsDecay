import { Player } from './player';

export interface Room {
    code: string;           // Code unique de la salle (ex:"ABC123" )
    gameId: string;         // ID du jeu selectionne
    gameName: string;
    maxPlayers: number;
    players: Player[];
    isLocked: boolean;
    organizerId: string;    // socket.id de lorganisateur
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
