import { Player } from '@common/player';
import { Lobby } from '../lobby';
import { Tile } from '../tile';
import { Vec2 } from '../vec2';
import { GameStats } from './game-stats';

export interface PlayerMovedData {
    socketId: string;
    position: Vec2;
    movementPoints: number;
    flagTaken?: boolean;
}

export interface CombatResult {
    winnerId: string;
    loserId: string;
    loser: Player;
    damage: number;
    loserHpLeft: number;
    killed: boolean;
    loserNewPosition: Vec2 | null;
    loserOldPosition: Vec2;
    wasFlagDropped?: boolean;
}

export interface GameStartedData {
    lobby: Lobby;
    turnOrder: string[];
    playerPositions: Record<string, Vec2>;
    playerStartPositions: Record<string, Vec2>;
}

export interface TileInfoData {
    tile: Tile;
    cost: number;
    player: { name: string; avatar: string } | null;
}

export interface GameOverData {
    winnerSocketId?: string | null;
    isForfeit?: boolean;
    abandonTeam?: string;
    players: Player[];
    gameStats: GameStats;
}
