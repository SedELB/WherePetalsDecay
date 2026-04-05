import { Direction, DIRECTION_OFFSETS } from '@common/direction';
import { TileItem } from '@common/enums';
import { Game } from '@common/game';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';

@Injectable()
export class MovementService {
    movePlayer(game: ActiveGame, socketId: string, direction: Direction): Vec2 | null {
        const currentPos = game.playerPositions.get(socketId);
        if (!currentPos) return null;

        const offset = DIRECTION_OFFSETS[direction];
        const targetPos: Vec2 = { x: currentPos.x + offset.x, y: currentPos.y + offset.y };

        if (!this.isValidMove(game, socketId, targetPos)) return null;

        const tile = game.lobby.game.grid[targetPos.y][targetPos.x];
        const cost = TILE_COSTS[tile.type];

        const remaining = game.movementPoints.get(socketId) - cost;
        game.movementPoints.set(socketId, remaining);
        game.playerPositions.set(socketId, targetPos);

        return targetPos;
    }

    teleportPlayer(game: ActiveGame, socketId: string, targetPos: Vec2): Vec2 | null {
        const currentPos = game.playerPositions.get(socketId);
        if (!currentPos) return null;

        if (!this.isValidTeleportMove(game, targetPos)) return null;

        game.playerPositions.set(socketId, targetPos);

        return targetPos;
    }

    getReachableTilesForTeleport(game: ActiveGame, socketId: string): Vec2[] {
        const startPos = game.playerPositions.get(socketId);
        if (!startPos) return [];

        const reachable: Vec2[] = [];
        const visited = new Map<string, number>();
        const queue: { pos: Vec2; cost: number }[] = [{ pos: startPos, cost: 0 }];

        visited.set(this.posKey(startPos), 0);

        while (queue.length > 0) {
            const current = queue.shift();

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const nextPos: Vec2 = { x: current.pos.x + offset.x, y: current.pos.y + offset.y };
                const key = this.posKey(nextPos);

                if (!this.isWithinBounds(game.lobby.game, nextPos)) continue;
                if (visited.has(key)) continue;
                visited.set(key, 0);

                const tile = game.lobby.game.grid[nextPos.y][nextPos.x];
                const tileCost = TILE_COSTS[tile.type];
                if (tileCost === Infinity) continue;
                if (tile.item === TileItem.Spawn) continue;
                if (this.isTileOccupied(game, nextPos)) continue;

                reachable.push(nextPos);
                queue.push({ pos: nextPos, cost: 0 });
            }
        }

        return reachable;
    }

    getReachableTiles(game: ActiveGame, socketId: string): Vec2[] {
        const startPos = game.playerPositions.get(socketId);
        if (!startPos) return [];

        const remaining = game.movementPoints.get(socketId);
        const bestCost = new Map<string, number>();
        const queue: { pos: Vec2; cost: number }[] = [{ pos: startPos, cost: 0 }];

        bestCost.set(this.posKey(startPos), 0);

        while (queue.length > 0) {
            let minIndex = 0;
            for (let i = 1; i < queue.length; i++) {
                if (queue[i].cost < queue[minIndex].cost) minIndex = i;
            }
            const current = queue.splice(minIndex, 1)[0];

            const currentKey = this.posKey(current.pos);
            if (current.cost > bestCost.get(currentKey)) continue;

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const nextPos: Vec2 = { x: current.pos.x + offset.x, y: current.pos.y + offset.y };

                if (!this.isWithinBounds(game.lobby.game, nextPos)) continue;

                if (this.isTileOccupied(game, nextPos)) continue;

                const tile = game.lobby.game.grid[nextPos.y][nextPos.x];
                const tileCost = TILE_COSTS[tile.type];
                if (tileCost === Infinity) continue;

                const totalCost = current.cost + tileCost;
                if (totalCost > remaining) continue;

                const key = this.posKey(nextPos);
                const previousCost = bestCost.get(key);
                if (previousCost !== undefined && previousCost <= totalCost) continue;

                bestCost.set(key, totalCost);
                queue.push({ pos: nextPos, cost: totalCost });
            }
        }

        bestCost.delete(this.posKey(startPos));

        const reachable: Vec2[] = [];
        for (const key of bestCost.keys()) {
            const [x, y] = key.split(',').map(Number);
            if (!this.isTileOccupied(game, { x, y })) {
                reachable.push({ x, y });
            }
        }

        return reachable;
    }

    getMovementPoints(game: ActiveGame, socketId: string): number {
        return game.movementPoints.get(socketId) ?? 0;
    }

    private isValidTeleportMove(game: ActiveGame, targetPos: Vec2): boolean {
        if (!this.isWithinBounds(game.lobby.game, targetPos)) return false;

        const tile = game.lobby.game.grid[targetPos.y][targetPos.x];
        const cost = TILE_COSTS[tile.type];

        if (cost === Infinity || tile.item === TileItem.Spawn || this.isTileOccupied(game, targetPos)) return false;

        return true;
    }

    private isValidMove(game: ActiveGame, socketId: string, targetPos: Vec2): boolean {
        if (!this.isWithinBounds(game.lobby.game, targetPos)) return false;

        const tile = game.lobby.game.grid[targetPos.y][targetPos.x];
        const cost = TILE_COSTS[tile.type];

        if (cost === Infinity) return false;
        if (cost > game.movementPoints.get(socketId)) return false;
        if (this.isTileOccupied(game, targetPos)) return false;

        return true;
    }

    private isWithinBounds(game: Game, pos: Vec2): boolean {
        return pos.y >= 0 && pos.y < game.grid.length && pos.x >= 0 && pos.x < game.grid[0].length;
    }

    private isTileOccupied(game: ActiveGame, pos: Vec2): boolean {
        for (const [, playerPos] of game.playerPositions) {
            if (playerPos.x === pos.x && playerPos.y === pos.y) return true;
        }
        return false;
    }

    private posKey(pos: Vec2): string {
        return `${pos.x},${pos.y}`;
    }
}
