import { Lobby } from '../lobby';
import { Tile } from '../tile';
import { Vec2 } from '../vec2';

export interface PlayerMovedData {
    socketId: string;
    position: Vec2;
    movementPoints: number;
}

export interface GameStartedData {
    lobby: Lobby;
    turnOrder: string[];
    playerPositions: Record<string, Vec2>;
}

export interface TileInfoData {
    tile: Tile;
    cost: number;
    player: { name: string; avatar: string } | null;
}
