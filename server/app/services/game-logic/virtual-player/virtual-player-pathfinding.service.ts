import { DIRECTION_OFFSETS } from '@common/direction';
import { TileItem, TileTexture } from '@common/enums';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';

interface DijkstraNode {
    position: Vec2;
    cumulativeCost: number;
}

export interface DijkstraResult {
    // Minimum cost to reach each position from the start (without impassable tiles)
    costToPosition: Map<string, number>;
    // Maps each reachable position key to the key of the tile that precedes it on the shortest path
    predecessorKey: Map<string, string | null>;
}

@Injectable()
export class VirtualPlayerPathfindingService {
    // Runs Dijkstra from 'startPos' across the game grid.
    // withDoors = true : closed doors are treated as cost 1 tile
    // withDoors = false : closed doors are impassable
    // blockPlayersExcept : when set, tiles occupied by other players are treated as impassable
    //                      (the given socketId is excluded from blocking)
    computeFullDijkstra(game: ActiveGame, startPos: Vec2, withDoors = false, blockPlayersExcept?: string): DijkstraResult {
        const costToPosition = new Map<string, number>();
        const predecessorKey = new Map<string, string | null>();
        const queue: DijkstraNode[] = [];

        const startKey = this.positionKey(startPos);
        costToPosition.set(startKey, 0);
        predecessorKey.set(startKey, null);
        queue.push({ position: startPos, cumulativeCost: 0 });

        while (queue.length > 0) {
            const currentNode = this.extractMinCostNode(queue);
            const currentKey = this.positionKey(currentNode.position);

            if (currentNode.cumulativeCost > (costToPosition.get(currentKey) ?? Infinity)) {
                continue;
            }

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const neighbourPos: Vec2 = {
                    x: currentNode.position.x + offset.x,
                    y: currentNode.position.y + offset.y,
                };

                if (!this.isInsideBounds(game, neighbourPos)) continue;

                const tile = game.lobby.game.grid[neighbourPos.y][neighbourPos.x];
                const moveCost = (withDoors && tile.type === TileTexture.DoorClosed)
                    ? 1
                    : TILE_COSTS[tile.type];
                if (moveCost === Infinity) continue;
                if (this.isSanctuaryTile(game, neighbourPos)) continue;
                if (blockPlayersExcept && this.isTileOccupiedByAnotherPlayer(game, neighbourPos, blockPlayersExcept)) continue;

                const neighbourKey = this.positionKey(neighbourPos);
                const newCost = currentNode.cumulativeCost + moveCost;
                const knownCost = costToPosition.get(neighbourKey) ?? Infinity;

                if (newCost < knownCost) {
                    costToPosition.set(neighbourKey, newCost);
                    predecessorKey.set(neighbourKey, currentKey);
                    queue.push({ position: neighbourPos, cumulativeCost: newCost });
                }
            }
        }

        return { costToPosition, predecessorKey };
    }


    // Step list from 'startPos' to 'targetPos' without the start position
    // Returns null when 'targetPos' is unreachable
    reconstructPath(targetPos: Vec2, predecessorKey: Map<string, string | null>): Vec2[] | null {
        const targetKey = this.positionKey(targetPos);
        if (!predecessorKey.has(targetKey)) return null;

        const path: Vec2[] = [];
        let currentKey: string | null = targetKey;

        while (currentKey !== null) {
            const [x, y] = currentKey.split(',').map(z => Number(z));
            path.push({ x, y });
            currentKey = predecessorKey.get(currentKey) ?? null;
        }

        path.reverse();
        path.shift();
        return path.length > 0 ? path : null;
    }


    // Walks step by step and returns the last position reachable within
    // 'remainingMovementPoints' that is not occupied by another player
    findFurthestReachablePositionOnPath(
        game: ActiveGame,
        path: Vec2[],
        remainingMovementPoints: number,
        excludedSocketId: string,
        withDoors = false,
    ): Vec2 | null {
        let accumulatedCost = 0;
        let bestReachablePosition: Vec2 | null = null;

        for (const step of path) {
            const tile = game.lobby.game.grid[step.y][step.x];
            const moveCost = (withDoors && tile.type === TileTexture.DoorClosed)
                ? 1
                : TILE_COSTS[tile.type];
            if (moveCost === Infinity) break;

            accumulatedCost += moveCost;
            if (accumulatedCost > remainingMovementPoints) break;

            if (this.isTileOccupiedByAnotherPlayer(game, step, excludedSocketId)) break;

            bestReachablePosition = step;
        }

        return bestReachablePosition;
    }


    // Returns all positions reachable within 'remainingMovementPoints' that are not
    // occupied by another player (excluding 'excludedSocketId').
    getReachableTilesWithinBudget(
        game: ActiveGame,
        startPos: Vec2,
        remainingMovementPoints: number,
        excludedSocketId: string,
        withDoors = false,
    ): Vec2[] {
        const { costToPosition } = this.computeFullDijkstra(game, startPos, withDoors, excludedSocketId);
        const reachable: Vec2[] = [];
        const startKey = this.positionKey(startPos);

        for (const [key, cost] of costToPosition) {
            if (key === startKey) continue;
            if (cost > remainingMovementPoints) continue;

            const [x, y] = key.split(',').map(z => Number(z));
            const pos: Vec2 = { x, y };

            if (withDoors && game.lobby.game.grid[y]?.[x]?.type === TileTexture.DoorClosed) continue;

            if (!this.isTileOccupiedByAnotherPlayer(game, pos, excludedSocketId)) {
                reachable.push(pos);
            }
        }

        return reachable;
    }

    positionKey(pos: Vec2): string {
        return `${pos.x},${pos.y}`;
    }

    isTileOccupiedByAnotherPlayer(game: ActiveGame, pos: Vec2, excludedSocketId: string): boolean {
        for (const [socketId, playerPos] of game.playerPositions) {
            if (socketId === excludedSocketId) continue;
            if (playerPos.x === pos.x && playerPos.y === pos.y) return true;
        }
        return false;
    }

    isSanctuaryTile(game: ActiveGame, pos: Vec2): boolean {
        const tile = game.lobby.game.grid[pos.y]?.[pos.x];
        return tile?.item === TileItem.HealingSanctuary || tile?.item === TileItem.CombatSanctuary;
    }

    private isInsideBounds(game: ActiveGame, pos: Vec2): boolean {
        const { grid } = game.lobby.game;
        return pos.y >= 0 && pos.y < grid.length && pos.x >= 0 && pos.x < grid[0].length;
    }

    private extractMinCostNode(queue: DijkstraNode[]): DijkstraNode {
        let minIndex = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].cumulativeCost < queue[minIndex].cumulativeCost) minIndex = i;
        }
        return queue.splice(minIndex, 1)[0];
    }
}