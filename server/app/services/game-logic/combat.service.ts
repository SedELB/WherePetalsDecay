import { DIRECTION_OFFSETS } from '@common/direction';
import { TileItem } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame, CombatResult, VICTORIES_TO_WIN } from './active-game.interface';

@Injectable()
export class CombatService {
    getAdjacentPlayers(game: ActiveGame, socketId: string): Player[] {
        const pos = game.playerPositions.get(socketId);
        if (!pos) return [];

        const adjacentPositions = Object.values(DIRECTION_OFFSETS).map((offset) => ({
            x: pos.x + offset.x,
            y: pos.y + offset.y,
        }));

        return game.lobby.players.filter((player) => {
            if (player.socketId === socketId || player.hasAbandonned) return false;
            const pPos = game.playerPositions.get(player.socketId);
            return pPos && adjacentPositions.some((adj) => adj.x === pPos.x && adj.y === pPos.y);
        });
    }

    initiateCombat(game: ActiveGame, attackerId: string, defenderId: string): CombatResult | null {
        if (game.hasCombatted.get(attackerId)) return null;

        const adjacentPlayers = this.getAdjacentPlayers(game, attackerId);
        if (!adjacentPlayers.some((player) => player.socketId === defenderId)) return null;

        const attacker = game.lobby.players.find((player) => player.socketId === attackerId);
        const defender = game.lobby.players.find((player) => player.socketId === defenderId);
        if (!attacker || !defender) return null;

        game.hasCombatted.set(attackerId, true);
        attacker.winsCount++;

        const loserNewPosition = this.resetLoserPosition(game, defenderId);

        return {
            winnerId: attackerId,
            loserId: defenderId,
            damage: defender.character.life,
            loserHpLeft: defender.character.life,
            killed: true,
            loserNewPosition,
        };
    }

    checkWinCondition(game: ActiveGame): Player | null {
        return game.lobby.players.find((player) => player.winsCount >= VICTORIES_TO_WIN) || null;
    }

    private resetLoserPosition(game: ActiveGame, loserId: string): Vec2 | null {
        const deathPos = game.playerPositions.get(loserId);
        if (!deathPos) return null;

        const spawnPoints = this.getSpawnPositions(game);
        const closestSpawn = this.findClosestAvailableSpawn(game, deathPos, spawnPoints, loserId);

        if (closestSpawn) {
            game.playerPositions.set(loserId, { ...closestSpawn });
        }
        return closestSpawn;
    }

    private getSpawnPositions(game: ActiveGame): Vec2[] {
        const spawns: Vec2[] = [];
        const grid = game.lobby.game.grid;
        for (let row = 0; row < grid.length; row++) {
            for (let col = 0; col < grid[row].length; col++) {
                if (grid[row][col].item === TileItem.Spawn) {
                    spawns.push({ x: col, y: row });
                }
            }
        }
        return spawns;
    }

    private findClosestAvailableSpawn(game: ActiveGame, origin: Vec2, spawnPoints: Vec2[], excludeSocketId: string): Vec2 | null {
        const sorted = [...spawnPoints].sort((a, b) => {
            const distA = Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y);
            const distB = Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y);
            return distA - distB;
        });

        for (const spawn of sorted) {
            if (!this.isOccupied(game, spawn, excludeSocketId)) {
                return spawn;
            }
        }
        return null;
    }

    private isOccupied(game: ActiveGame, pos: Vec2, excludeSocketId: string): boolean {
        for (const [socketId, playerPos] of game.playerPositions) {
            if (socketId === excludeSocketId) continue;
            if (playerPos.x === pos.x && playerPos.y === pos.y) return true;
        }
        return false;
    }
}
