import { DIRECTION_OFFSETS } from '@common/direction';
import { GameMode, TileItem } from '@common/enums';
import { Player } from '@common/player';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';

@Injectable()
export class VirtualPlayerScannerService {
    constructor(private readonly pathfindingService: VirtualPlayerPathfindingService) {}

    getAdjacentOpponents(game: ActiveGame, virtualPlayer: Player, vpPos: Vec2): Player[] {
        const adjacentPositions = Object.values(DIRECTION_OFFSETS).map((offset) => ({
            x: vpPos.x + offset.x,
            y: vpPos.y + offset.y,
        }));

        const adjacentEnemies = game.lobby.players.filter((candidate) => {
            if (candidate.socketId === virtualPlayer.socketId || candidate.hasAbandonned) return false;
            if (!this.isOpponent(game, virtualPlayer, candidate)) return false;

            const pos = game.playerPositions.get(candidate.socketId);
            return pos && adjacentPositions.some((adj) => adj.x === pos.x && adj.y === pos.y);
        });

        return adjacentEnemies;
    }

    isOpponent(game: ActiveGame, virtualPlayer: Player, candidate: Player): boolean {
        if (game.lobby.game.gameMode !== GameMode.Ctf) return true;
        const vpInTeamA = game.lobby.teamA.some((p) => p.socketId === virtualPlayer.socketId);
        const candidateInTeamA = game.lobby.teamA.some((p) => p.socketId === candidate.socketId);
        return vpInTeamA !== candidateInTeamA; // Different team = opponent
    }

    findNearestEnemy(
        game: ActiveGame,
        virtualPlayer: Player,
        vpPos: Vec2,
    ): { player: Player; position: Vec2 } | null {
        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, vpPos);
        let lowestCost = Infinity;
        let result: { player: Player; position: Vec2 } | null = null;

        for (const candidate of game.lobby.players) {
            if (candidate.socketId === virtualPlayer.socketId || candidate.hasAbandonned) continue;
            if (!this.isOpponent(game, virtualPlayer, candidate)) continue;

            const candidatePos = game.playerPositions.get(candidate.socketId);
            if (!candidatePos) continue;

            const cost = costToPosition.get(this.pathfindingService.positionKey(candidatePos)) ?? Infinity;
            if (cost < lowestCost) {
                lowestCost = cost;
                result = { player: candidate, position: candidatePos };
            }
        }

        return result;
    }

    findEnemyFlagCarrier(game: ActiveGame, virtualPlayer: Player): Player | null {
        return game.lobby.players.find((p) => {
            if (p.socketId === virtualPlayer.socketId || p.hasAbandonned) return false;
            return p.hasFlag && this.isOpponent(game, virtualPlayer, p);
        }) ?? null;
    }

    chooseFleeTile(game: ActiveGame, virtualPlayer: Player, vpPos: Vec2): Vec2 | null {
        const remainingMvtPts = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const reachableTiles = this.pathfindingService.getReachableTilesWithinBudget(game, vpPos, remainingMvtPts, virtualPlayer.socketId);

        const opponentPositions = game.lobby.players
            .filter((p) => !p.hasAbandonned && p.socketId !== virtualPlayer.socketId && this.isOpponent(game, virtualPlayer, p))
            .map((p) => game.playerPositions.get(p.socketId));

        if (opponentPositions.length === 0) return null;

        // Also evaluate staying in the current position
        reachableTiles.push(vpPos);

        let bestTile: Vec2 | null = null;
        let bestMinDist = -1;

        for (const tile of reachableTiles) {
            const minDist = Math.min(
                ...opponentPositions.map((opp) => Math.abs(tile.x - opp.x) + Math.abs(tile.y - opp.y)),
            );
            if (minDist > bestMinDist) {
                bestMinDist = minDist;
                bestTile = tile;
            }
        }

        // If staying put is the safest option, no need to flee
        if (bestTile && bestTile.x === vpPos.x && bestTile.y === vpPos.y) return null;

        return bestTile;
    }

    findNearestSanctuary(game: ActiveGame, virtualPlayer: Player, vpPos: Vec2): Vec2 | null {
        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, vpPos);
        const remainingMvtPts = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        let nearestCost = Infinity;
        let result: Vec2 | null = null;

        const { grid } = game.lobby.game;
        for (let row = 0; row < grid.length; row++) { // TODO : can add extractsanctuaries method in game-setup to avoid iterating over entire grid each time
            for (let col = 0; col < grid[row].length; col++) {
                const item = grid[row][col].item;
                if (item !== TileItem.HealingSanctuary && item !== TileItem.CombatSanctuary) continue;

                const pos: Vec2 = { x: col, y: row };
                const cost = costToPosition.get(this.pathfindingService.positionKey(pos)) ?? Infinity;

                if (cost <= remainingMvtPts && cost < nearestCost &&
                    !this.pathfindingService.isTileOccupiedByAnotherPlayer(game, pos, virtualPlayer.socketId)) {
                    nearestCost = cost;
                    result = pos;
                }
            }
        }

        return result;
    }

    findFlagOnMap(game: ActiveGame): Vec2 | null {
        const { grid } = game.lobby.game;
        for (let row = 0; row < grid.length; row++) { // TODO : can add extractFlags method in game-setup to avoid iterating over entire grid each time
            for (let col = 0; col < grid[row].length; col++) {
                if (grid[row][col].item === TileItem.Flag) return { x: col, y: row };
            }
        }
        return null;
    }

    findNearestFreePositionAround(game: ActiveGame, origin: Vec2, excludedSocketId: string): Vec2 | null {
        if (!this.pathfindingService.isTileOccupiedByAnotherPlayer(game, origin, excludedSocketId)) return origin;

        const visited = new Set<string>([this.pathfindingService.positionKey(origin)]);
        const queue: Vec2[] = [origin];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) break;

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const neighbour: Vec2 = { x: current.x + offset.x, y: current.y + offset.y };
                const key = this.pathfindingService.positionKey(neighbour);
                if (visited.has(key)) continue;
                visited.add(key);

                const { grid } = game.lobby.game;
                if (neighbour.y < 0 || neighbour.y >= grid.length || neighbour.x < 0 || neighbour.x >= grid[0].length) continue;
                if (TILE_COSTS[grid[neighbour.y][neighbour.x].type] === Infinity) continue;

                if (!this.pathfindingService.isTileOccupiedByAnotherPlayer(game, neighbour, excludedSocketId)) return neighbour;
                queue.push(neighbour);
            }
        }

        return null;
    }
}