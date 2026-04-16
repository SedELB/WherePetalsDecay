import { DIRECTION_OFFSETS } from '@common/direction';
import { GameMode, TileItem } from '@common/enums';
import { Player } from '@common/player';
import { SanctuaryType } from '@common/tile';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
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
        withDoors = false,
    ): { player: Player; position: Vec2 } | null {
        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, vpPos, withDoors);
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

    findAllyFlagCarrier(game: ActiveGame, virtualPlayer: Player): Player | null {
        return game.lobby.players.find((p) => {
            if (p.socketId === virtualPlayer.socketId || p.hasAbandonned) return false;
            return p.hasFlag && !this.isOpponent(game, virtualPlayer, p);
        }) ?? null;
    }

    chooseFleeTile(game: ActiveGame, virtualPlayer: Player, vpPos: Vec2, withDoors = false): Vec2 | null {
        const remainingMvtPts = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const reachableTiles = this.pathfindingService.getReachableTilesWithinBudget(
            game, vpPos, remainingMvtPts, virtualPlayer.socketId, withDoors,
        );

        const opponentPositions = game.lobby.players
            .filter((p) => !p.hasAbandonned && p.socketId !== virtualPlayer.socketId && this.isOpponent(game, virtualPlayer, p))
            .map((p) => game.playerPositions.get(p.socketId));

        if (opponentPositions.length === 0) return null;

        // Evaluate staying in the current position
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

    findNearestTileAdjacentToSanctuary(
        game: ActiveGame,
        virtualPlayer: Player,
        vpPos: Vec2,
        options: {
            sanctuaryType: SanctuaryType;
            reachableThisTurn?: boolean;
            precomputedCostToPosition?: Map<string, number>;
        },
    ): Vec2 | null {
        const { sanctuaryType, reachableThisTurn = false, precomputedCostToPosition } = options;
        const remainingMvtPts = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const costToPosition = precomputedCostToPosition ?? this.pathfindingService.computeFullDijkstra(game, vpPos).costToPosition;
        const candidates = this.getSanctuaryBorderPositions(game, virtualPlayer, sanctuaryType);

        let nearestCost = Infinity;
        let nearestPos: Vec2 | null = null;
        for (const pos of candidates.values()) {
            const cost = costToPosition.get(this.pathfindingService.positionKey(pos)) ?? Infinity;
            const withinReach = !reachableThisTurn || cost <= remainingMvtPts;
            if (withinReach && cost < nearestCost) {
                nearestCost = cost;
                nearestPos = pos;
            }
        }

        return nearestPos;
    }

    private getSanctuaryBorderPositions(
        game: ActiveGame,
        virtualPlayer: Player,
        sanctuaryType: SanctuaryType,
    ): Map<string, Vec2> {
        const candidatesPos = new Map<string, Vec2>();
        const { grid } = game.lobby.game;

        for (const sanctuaryPos of game.sanctuaryPositions.get(sanctuaryType) ?? []) {
            if (this.isSanctuaryOnCooldown(game, sanctuaryPos, sanctuaryType)) continue;

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const borderPos: Vec2 = { x: sanctuaryPos.x + offset.x, y: sanctuaryPos.y + offset.y };
                if (!this.isInsideBounds(grid, borderPos)) continue;

                const borderTile = grid[borderPos.y][borderPos.x];
                if (borderTile.item === TileItem.HealingSanctuary || borderTile.item === TileItem.CombatSanctuary) continue;
                if (TILE_COSTS[borderTile.type] === Infinity) continue;
                if (this.pathfindingService.isTileOccupiedByAnotherPlayer(game, borderPos, virtualPlayer.socketId)) continue;

                candidatesPos.set(this.pathfindingService.positionKey(borderPos), borderPos);
            }
        }

        return candidatesPos;
    }

    private isSanctuaryOnCooldown(game: ActiveGame, sanctuaryPos: Vec2, sanctuaryType: SanctuaryType): boolean {
        const topLeft = this.findSanctuaryTopLeft(game, sanctuaryPos, sanctuaryType);
        return game.sanctuaryCooldowns.has(`${topLeft.x},${topLeft.y}`);
    }

    private findSanctuaryTopLeft(game: ActiveGame, pos: Vec2, item: SanctuaryType): Vec2 {
        let { x, y } = pos;
        const { grid } = game.lobby.game;
        while (grid[y - 1]?.[x]?.item === item) y--;
        while (grid[y]?.[x - 1]?.item === item) x--;
        return { x, y };
    }

    isTileAdjacentToSanctuary(game: ActiveGame, pos: Vec2, sanctuaryType: SanctuaryType): boolean {
        const { grid } = game.lobby.game;
        return Object.values(DIRECTION_OFFSETS).some((offset) => {
            const neighbour: Vec2 = { x: pos.x + offset.x, y: pos.y + offset.y };
            if (!this.isInsideBounds(grid, neighbour)) return false;
            if (grid[neighbour.y][neighbour.x].item !== sanctuaryType) return false;
            return !this.isSanctuaryOnCooldown(game, neighbour, sanctuaryType);
        });
    }

    findFlagOnMap(game: ActiveGame): Vec2 | null {
        const { grid } = game.lobby.game;
        for (let row = 0; row < grid.length; row++) {
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


    private isInsideBounds(grid: ActiveGame['lobby']['game']['grid'], pos: Vec2): boolean {
        return pos.y >= 0 && pos.y < grid.length && pos.x >= 0 && pos.x < grid[0].length;
    }
}