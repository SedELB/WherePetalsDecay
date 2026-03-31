import { DIRECTION_OFFSETS } from '@common/direction';
import { Player } from '@common/player';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame, VICTORIES_TO_WIN } from './active-game.interface';
import { CombatResult} from '@common/interfaces/game-view';

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
        const actionPoints = game.actionPoints.get(attackerId) ?? 0;
        if (actionPoints <= 0) return null;

        const adjacentPlayers = this.getAdjacentPlayers(game, attackerId);
        if (!adjacentPlayers.some((player) => player.socketId === defenderId)) return null;

        const attacker = game.lobby.players.find((player) => player.socketId === attackerId);
        const defender = game.lobby.players.find((player) => player.socketId === defenderId);
        if (!attacker || !defender) return null;

        game.actionPoints.set(attackerId, actionPoints - 1);
        attacker.winsCount++;

        const loserOldPosition = game.playerPositions.get(defenderId);
        const loserNewPosition = this.resetLoserPosition(game, defenderId);

        return {
            winnerId: attackerId,
            loserId: defenderId,
            loser: defender,
            damage: defender.character.life,
            loserHpLeft: defender.character.life,
            killed: true,
            loserNewPosition,
            loserOldPosition,
        };
    }

    checkWinCondition(game: ActiveGame): Player | null {
        return game.lobby.players.find((player) => player.winsCount >= VICTORIES_TO_WIN) || null;
    }

    private resetLoserPosition(game: ActiveGame, loserId: string): Vec2 | null {
        const startPos = game.playerStartPositions.get(loserId);
        if (!startPos) return null;

        if (!this.isOccupied(game, startPos, loserId)) {
            game.playerPositions.set(loserId, { ...startPos });
            return { ...startPos };
        }

        const fallback = this.findClosestValidTile(game, startPos, loserId);
        if (fallback) {
            game.playerPositions.set(loserId, { ...fallback });
        }
        return fallback;
    }

    private findClosestValidTile(game: ActiveGame, origin: Vec2, excludeSocketId: string): Vec2 | null {
        const grid = game.lobby.game.grid;
        const visited = new Set<string>();
        const queue: Vec2[] = [origin];
        visited.add(`${origin.x},${origin.y}`);

        while (queue.length > 0) {
            const current = queue.shift();

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const next: Vec2 = { x: current.x + offset.x, y: current.y + offset.y };
                const key = `${next.x},${next.y}`;

                if (visited.has(key)) continue;
                visited.add(key);

                if (next.y < 0 || next.y >= grid.length || next.x < 0 || next.x >= grid[0].length) continue;

                const tile = grid[next.y][next.x];
                if (TILE_COSTS[tile.type] === Infinity) continue;

                if (!this.isOccupied(game, next, excludeSocketId)) {
                    return next;
                }

                queue.push(next);
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
