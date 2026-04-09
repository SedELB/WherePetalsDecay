import { MS_PER_SECOND, PERCENT } from '@common/constants/game-stats.constants';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { GameStats } from '@common/interfaces/game-stats';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';

@Injectable()
export class GameStatsService {
    buildGameStats(game: ActiveGame): GameStats {
        const grid = game.lobby.game.grid;
        const totalTerrainTiles = this.countTerrainTiles(grid);
        const totalSanctuaries = this.countTilesByItem(grid, [TileItem.HealingSanctuary, TileItem.CombatSanctuary]);
        const totalDoors = this.countTilesByType(grid, [TileTexture.DoorOpened, TileTexture.DoorClosed]);
        const totalOpenDoors = this.countTilesByType(grid, [TileTexture.DoorOpened]);

        const visitedPercent = totalTerrainTiles > 0
            ? (game.globalVisitedTiles.size / totalTerrainTiles) * PERCENT
            : 0;

        const sanctuaryPercent = totalSanctuaries > 0
            ? (game.sanctuariesUsed.size / totalSanctuaries) * PERCENT
            : null;

        const doorsPercent = (totalDoors > 0 || totalOpenDoors > 0)
            ? (game.doorsInteracted.size / Math.max(totalDoors, 1)) * PERCENT
            : null;

        const isCTF = game.lobby.game.gameMode === GameMode.Ctf;
        const flagHoldersCount = isCTF ? game.flagHolders.size : null;

        for (const player of game.lobby.players) {
            const playerTiles = game.visitedTilesPerPlayer.get(player.socketId);
            player.visitedTilesCount = playerTiles ? playerTiles.size : 0;
        }

        return {
            gameDurationSeconds: Math.floor((Date.now() - game.gameStartTime) / MS_PER_SECOND),
            totalTurns: game.totalTurns,
            totalTerrainTiles,
            visitedTilesPercentage: visitedPercent,
            sanctuaryUsagePercentage: sanctuaryPercent,
            doorsManipulatedPercentage: doorsPercent,
            uniqueFlagHoldersCount: flagHoldersCount,
        };
    }

    private countTerrainTiles(grid: ActiveGame['lobby']['game']['grid']): number {
        let count = 0;
        for (const row of grid) {
            for (const tile of row) {
                if (tile.type === TileTexture.Floor || tile.type === TileTexture.Water || tile.type === TileTexture.Ice) {
                    count++;
                }
            }
        }
        return count;
    }

    private countTilesByItem(grid: ActiveGame['lobby']['game']['grid'], items: TileItem[]): number {
        let count = 0;
        for (const row of grid) {
            for (const tile of row) {
                if (tile.item && items.includes(tile.item)) count++;
            }
        }
        return count;
    }

    private countTilesByType(grid: ActiveGame['lobby']['game']['grid'], types: TileTexture[]): number {
        let count = 0;
        for (const row of grid) {
            for (const tile of row) {
                if (types.includes(tile.type)) count++;
            }
        }
        return count;
    }
}
