import { PositionCostEntry, TileVisitParams } from '@app/interfaces/game-logic.interface';
import { Direction, DIRECTION_OFFSETS } from '@common/direction';
import { TileItem, TileTexture } from '@common/enums';
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

        this.trackTileVisit({ game, socketId, pos: targetPos, tileType: tile.type, tileItem: tile.item });

        return targetPos;
    }

    teleportPlayer(game: ActiveGame, socketId: string, targetPos: Vec2): Vec2 | null {
        const currentPos = game.playerPositions.get(socketId);
        if (!currentPos) return null;

        if (!this.isValidTeleportMove(game, targetPos, socketId)) return null;

        const reachable = this.getReachableTilesForTeleport(game);
        const isReachableCheck = reachable.some((p) => p.x === targetPos.x && p.y === targetPos.y);
        if (!isReachableCheck) return null;

        game.playerPositions.set(socketId, targetPos);

        return targetPos;
    }

    getReachableTilesForTeleport(game: ActiveGame): Vec2[] {
        const reachable: Vec2[] = [];
        const grid = game.lobby.game.grid;

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const pos = { x, y };
                if (this.isValidTeleportMove(game, pos)) {
                    reachable.push(pos);
                }
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
            const current = this.popLowestCostEntry(queue);

            const currentKey = this.posKey(current.pos);
            if (current.cost > bestCost.get(currentKey)) continue;

            this.enqueueReachableNeighbors(game, current, remaining, bestCost, queue);
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

    private popLowestCostEntry(queue: PositionCostEntry[]): PositionCostEntry {
        let minIndex = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].cost < queue[minIndex].cost) minIndex = i;
        }
        return queue.splice(minIndex, 1)[0];
    }

    private enqueueReachableNeighbors(
        game: ActiveGame,
        current: { pos: Vec2; cost: number },
        remaining: number,
        bestCost: Map<string, number>,
        queue: { pos: Vec2; cost: number }[],
    ): void {
        for (const offset of Object.values(DIRECTION_OFFSETS)) {
            const nextPos: Vec2 = { x: current.pos.x + offset.x, y: current.pos.y + offset.y };
            this.tryQueueReachableTile({ game, nextPos, currentCost: current.cost, remaining, bestCost, queue });
        }
    }

    private tryQueueReachableTile(params: {
        game: ActiveGame;
        nextPos: Vec2;
        currentCost: number;
        remaining: number;
        bestCost: Map<string, number>;
        queue: { pos: Vec2; cost: number }[];
    }): void {
        const { game, nextPos, currentCost, remaining, bestCost, queue } = params;

        if (!this.isWithinBounds(game.lobby.game, nextPos)) return;
        if (this.isTileOccupied(game, nextPos)) return;

        const tile = game.lobby.game.grid[nextPos.y][nextPos.x];
        const tileCost = TILE_COSTS[tile.type];
        if (tileCost === Infinity) return;
        if (this.isSanctuaryTile(game, nextPos)) return;

        const totalCost = currentCost + tileCost;
        if (totalCost > remaining) return;

        const key = this.posKey(nextPos);
        const previousCost = bestCost.get(key);
        if (previousCost !== undefined && previousCost <= totalCost) return;

        bestCost.set(key, totalCost);
        queue.push({ pos: nextPos, cost: totalCost });
    }

    private isSanctuaryTile(game: ActiveGame, pos: Vec2): boolean {
        const tile = game.lobby.game.grid[pos.y]?.[pos.x];
        return tile?.item === TileItem.HealingSanctuary || tile?.item === TileItem.CombatSanctuary;
    }

    private isValidTeleportMove(game: ActiveGame, targetPos: Vec2, excludeSocketId?: string): boolean {
        if (!this.isWithinBounds(game.lobby.game, targetPos)) return false;

        const tile = game.lobby.game.grid[targetPos.y][targetPos.x];
        const cost = TILE_COSTS[tile.type];

        if (cost === Infinity) return false;
        if (this.isSanctuaryTile(game, targetPos)) return false;
        if (tile.item === TileItem.Spawn) return false;
        if (this.isTileOccupied(game, targetPos, excludeSocketId)) return false;

        return true;
    }

    private isValidMove(game: ActiveGame, socketId: string, targetPos: Vec2): boolean {
        if (!this.isWithinBounds(game.lobby.game, targetPos)) return false;

        const tile = game.lobby.game.grid[targetPos.y][targetPos.x];
        const cost = TILE_COSTS[tile.type];

        if (cost === Infinity) return false;
        if (cost > game.movementPoints.get(socketId)) return false;
        if (this.isSanctuaryTile(game, targetPos)) return false;
        if (this.isTileOccupied(game, targetPos, socketId)) return false;

        return true;
    }

    private isWithinBounds(game: Game, pos: Vec2): boolean {
        return pos.y >= 0 && pos.y < game.grid.length && pos.x >= 0 && pos.x < game.grid[0].length;
    }

    private isTileOccupied(game: ActiveGame, pos: Vec2, excludeSocketId?: string): boolean {
        for (const [socketId, playerPos] of game.playerPositions) {
            if (socketId === excludeSocketId) continue;
            if (playerPos.x === pos.x && playerPos.y === pos.y) return true;
        }
        return false;
    }

    private trackTileVisit(params: TileVisitParams): void {
        const { game, socketId, pos, tileType, tileItem } = params;
        const key = this.posKey(pos);
        const isTerrainTile =
            tileType === TileTexture.Floor || tileType === TileTexture.Water || tileType === TileTexture.Ice || tileType === TileTexture.DoorOpened;
        if (isTerrainTile) {
            if (!game.visitedTilesPerPlayer.has(socketId)) {
                game.visitedTilesPerPlayer.set(socketId, new Set());
            }
            game.visitedTilesPerPlayer.get(socketId).add(key);
            game.globalVisitedTiles.add(key);
        }

        if (tileItem === TileItem.HealingSanctuary || tileItem === TileItem.CombatSanctuary) {
            game.sanctuariesUsed.add(key);
        }

        if (tileType === TileTexture.DoorOpened) {
            game.doorsInteracted.add(key);
        }

        if (tileItem === TileItem.Flag) {
            game.flagHolders.add(socketId);
        }
    }

    private posKey(pos: Vec2): string {
        return `${pos.x},${pos.y}`;
    }
}
