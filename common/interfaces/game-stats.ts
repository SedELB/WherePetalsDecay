import { Player } from '../player';

export interface GameStats {
    gameDurationSeconds: number;
    totalTurns: number;
    totalTerrainTiles: number;
    visitedTilesPercentage: number;
    sanctuaryUsagePercentage: number | null;
    doorsManipulatedPercentage: number | null;
    uniqueFlagHoldersCount: number | null;
}

export interface GameOverData {
    winnerSocketId: string | null;
    isForfeit: boolean;
    players: Player[];
    gameStats: GameStats;
}
