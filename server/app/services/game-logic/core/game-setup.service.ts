import { TileItem, TileTexture } from '@common/enums';
import { Game } from '@common/game';
import { GameStats } from '@common/interfaces/game-stats';
import { SanctuaryType } from '@common/tile';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Inject, Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';
import { GameStatsService } from './game-stats.service';

const RANDOM_THRESHOLD = 0.5;

@Injectable()
export class GameSetupService {
    @Inject() private readonly gameStatsService: GameStatsService;

    buildGameStats(game: ActiveGame): GameStats {
        return this.gameStatsService.buildGameStats(game);
    }

    extractSpawnPositions(game: Game): Vec2[] {
        const spawns: Vec2[] = [];
        for (let row = 0; row < game.grid.length; row++) {
            for (let col = 0; col < game.grid[row].length; col++) {
                if (game.grid[row][col].item === TileItem.Spawn) {
                    spawns.push({ x: col, y: row });
                }
            }
        }
        return spawns;
    }

    removeUnusedSpawns(game: Game, shuffledSpawns: Vec2[], playerCount: number): void {
        const usedSpawns = new Set(shuffledSpawns.slice(0, playerCount).map((s) => `${s.x},${s.y}`));
        for (let row = 0; row < game.grid.length; row++) {
            for (let col = 0; col < game.grid[row].length; col++) {
                if (game.grid[row][col].item === TileItem.Spawn && !usedSpawns.has(`${col},${row}`)) {
                    game.grid[row][col].item = null;
                }
            }
        }
    }

    computeTurnOrder(players: Player[]): string[] {
        const sorted = [...players].sort((a, b) => {
            const speedDiff = b.character.speed - a.character.speed;
            if (speedDiff !== 0) return speedDiff;
            return Math.random() - RANDOM_THRESHOLD;
        });
        return sorted.map((p) => p.socketId);
    }

    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    extractSanctuaryPositions(game: Game): Map<SanctuaryType, Vec2[]> {
        const result = new Map<SanctuaryType, Vec2[]>([
            [TileItem.HealingSanctuary, []],
            [TileItem.CombatSanctuary, []],
        ]);
        for (let row = 0; row < game.grid.length; row++) {
            for (let col = 0; col < game.grid[row].length; col++) {
                const item = game.grid[row][col].item;
                if (item === TileItem.HealingSanctuary || item === TileItem.CombatSanctuary) {
                    result.get(item)?.push({ x: col, y: row });
                }
            }
        }
        return result;
    }

    extractDoorPositions(game: Game): Vec2[] {
        const doors: Vec2[] = [];
        for (let row = 0; row < game.grid.length; row++) {
            for (let col = 0; col < game.grid[row].length; col++) {
                const tileType = game.grid[row][col].type;
                if (tileType === TileTexture.DoorClosed || tileType === TileTexture.DoorOpened) {
                    doors.push({ x: col, y: row });
                }
            }
        }
        return doors;
    }
}
