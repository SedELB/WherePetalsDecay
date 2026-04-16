import { DIRECTION_OFFSETS } from '@common/direction';
import { TileItem, TileTexture, VirtualPlayerProfile } from '@common/enums';
import { Player } from '@common/player';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from '../core/active-game.interface';
import { HEALING_SANCTUARY_MIN_MISSING_HP, TurnContext, VPActionService } from './vp-action.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';

@Injectable()
export class VPClassicStrategyService {
    constructor(
        private readonly actionService: VPActionService,
        private readonly pathfindingService: VirtualPlayerPathfindingService,
        private readonly scanner: VirtualPlayerScannerService,
    ) {}

    // ------------
    // Classic mode

    runClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { virtualPlayer } = context;
        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runAggressiveClassicTurn(context, currentPos);
        } else {
            this.runDefensiveClassicTurn(context, currentPos);
        }
    }

    // Aggressive classic:
    //   1. if Adjacent enemy : attack immediately
    //   2. if Enemy reachable this turn : move toward enemy (opening doors), then attack
    //   3. Enemy NOT reachable:
    //      a. Door on path : save AP for door, move toward enemy, skip sanctuaries
    //      b. No door on path : check sanctuary on path, then move toward enemy
    private runAggressiveClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        if (actionPoints <= 0) {
            this.runAggressivePostCombatMovement(context, currentPos);
            return;
        }

        // Priority 1: attack adjacent enemy
        if (this.actionService.tryAttackAdjacentEnemy(context)) return;

        const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos, true);
        if (!nearestEnemy) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        // Priority 2: enemy reachable this turn → move and attack
        if (this.actionService.isEnemyReachableThisTurn(game, virtualPlayer, currentPos, nearestEnemy.position)) {
            this.actionService.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
                const hasStartedCombat = this.actionService.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.continueTurnAfterMovement(context);
            });
            return;
        }

        // Priority 3: enemy NOT reachable this turn
        const hasDoorOnPath = this.actionService.hasClosedDoorOnPath(game, currentPos, nearestEnemy.position);

        // 3a. No door on path : try sanctuary along the way to the enemy
        if (!hasDoorOnPath && this.tryClassicPathSanctuary(context, currentPos, nearestEnemy.position)) return;

        // 3b. Move toward enemy (opening doors if needed along the way)
        this.actionService.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
            const hasStartedCombat = this.actionService.tryAttackAdjacentEnemy(context);
            if (!hasStartedCombat) this.continueTurnAfterMovement(context);
        });
    }

    // Post-combat aggressive movement (AP=0):
    //   Move toward nearest enemy, no sanctuary detours
    private runAggressivePostCombatMovement(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos, true);
        if (!nearestEnemy) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        this.actionService.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
            const hasStartedCombat = this.actionService.tryAttackAdjacentEnemy(context);
            if (!hasStartedCombat) {
                const ap = context.game.actionPoints.get(context.virtualPlayer.socketId) ?? 0;
                const posAfterMove = context.game.playerPositions.get(context.virtualPlayer.socketId);
                const isEnemyAdjacent = posAfterMove
                    ? this.scanner.getAdjacentOpponents(context.game, context.virtualPlayer, posAfterMove).length > 0
                    : false;

                if (ap <= 0 && isEnemyAdjacent) {
                    this.actionService.endVirtualPlayerTurn(context.lobbyId);
                    return;
                }

                this.continueTurnAfterMovement(context);
            }
        });
    }

    // Defensive classic:
    //   1. Cornered (no reachable tile + enemy adjacent) : end turn (never attack)
    //   2. Flee: maximize distance from enemies
    //   3. Door on flee path : open door and flee, NO sanctuary
    //   4. No door on flee path : check sanctuary on path (healing > combat)
    private runDefensiveClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // Defensive door control: if cornered near a door with an enemy behind it,
        // close the door to block the threat before ending turn.
        if (this.tryHandleDefensiveBlockedDoor(context, currentPos)) {
            return;
        }

        // Cornered: no reachable tiles and enemy adjacent → end turn (never initiate combat)
        if (this.isDefensiveFullyCornered(context, currentPos)) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const fleeTarget = this.scanner.chooseFleeTile(game, virtualPlayer, currentPos, actionPoints > 0);
        if (!fleeTarget) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const hasDoorOnFleePath = this.actionService.hasClosedDoorOnPath(game, currentPos, fleeTarget);

        if (hasDoorOnFleePath) {
            // Door on flee path : open door and flee, no sanctuary usage
            this.actionService.moveTowardThenActWithDoors(context, currentPos, fleeTarget, () => {
                this.continueTurnAfterMovement(context);
            });
            return;
        }

        // No door on flee path : try sanctuary along the flee path
        if (actionPoints > 0) {
            const isInjured = virtualPlayer.character.life <= this.actionService.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
            const hasCombatBonus = this.actionService.hasCombatBonus(game, virtualPlayer.socketId);

            if ((isInjured || !hasCombatBonus) && this.tryClassicPathSanctuary(context, currentPos, fleeTarget)) return;
        }

        // Just flee
        this.actionService.moveTowardThenActWithDoors(context, currentPos, fleeTarget, () => {
            this.continueTurnAfterMovement(context);
        });
    }

    // Returns true if the VP cannot take any step from its current position.
    // Checks direct neighbors instead of Dijkstra to avoid seeing through blocking players.
    private isDefensiveFullyCornered(context: TurnContext, currentPos: Vec2): boolean {
        const { game, virtualPlayer } = context;
        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) return true;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        const hasWalkableNeighbor = (Object.values(DIRECTION_OFFSETS) as Vec2[]).some((offset) => {
            const neighbor = { x: currentPos.x + offset.x, y: currentPos.y + offset.y };
            const tile = game.lobby.game.grid[neighbor.y]?.[neighbor.x];
            if (!tile) return false;
            if (this.pathfindingService.isSanctuaryTile(game, neighbor)) return false;
            if (this.pathfindingService.isTileOccupiedByAnotherPlayer(game, neighbor, virtualPlayer.socketId)) return false;
            if (tile.type === TileTexture.DoorClosed) return actionPoints > 0;
            const cost = TILE_COSTS[tile.type];
            return cost !== Infinity && cost <= remainingMovement;
        });

        return !hasWalkableNeighbor;
    }

    private tryHandleDefensiveBlockedDoor(context: TurnContext, currentPos: Vec2): boolean {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // If an adjacent opened door has an enemy on the other side, close it to block the threat.
        const openedThreatDoor = this.findAdjacentThreatDoor(context, currentPos, true);
        if (openedThreatDoor) {
            if (actionPoints > 0) this.actionService.tryToggleDoorAtPosition(context, openedThreatDoor, TileTexture.DoorOpened);
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return true;
        }

        // If the only adjacent tiles are doors and a closed door has an enemy behind it, don't open it.
        if (this.hasReachableNonDoorTile(game, virtualPlayer, currentPos)) return false;

        const threatDoor = this.findAdjacentThreatDoor(context, currentPos, false);
        if (threatDoor) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return true;
        }

        return false;
    }

    private hasReachableNonDoorTile(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2): boolean {
        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const reachableWithoutDoors = this.pathfindingService.getReachableTilesWithinBudget(
            game, currentPos, remainingMovement, virtualPlayer.socketId, false,
        );
        return reachableWithoutDoors.some((pos) => {
            const tile = game.lobby.game.grid[pos.y]?.[pos.x];
            return tile?.type !== TileTexture.DoorOpened && tile?.type !== TileTexture.DoorClosed;
        });
    }

    private findAdjacentThreatDoor(context: TurnContext, currentPos: Vec2, openedOnly: boolean): Vec2 | null {
        const { game } = context;
        const adjacentDoors: Vec2[] = (Object.values(DIRECTION_OFFSETS) as Vec2[])
            .map((offset) => ({ x: currentPos.x + offset.x, y: currentPos.y + offset.y }))
            .filter((pos) => {
                const tile = game.lobby.game.grid[pos.y]?.[pos.x];
                if (!tile) return false;
                if (openedOnly) return tile.type === TileTexture.DoorOpened;
                return tile.type === TileTexture.DoorClosed || tile.type === TileTexture.DoorOpened;
            });

        for (const doorPos of adjacentDoors) {
            if (this.isOpponentAdjacentToDoor(context, doorPos, currentPos)) return doorPos;
        }

        return null;
    }

    private isOpponentAdjacentToDoor(context: TurnContext, doorPos: Vec2, currentPos: Vec2): boolean {
        const { game, virtualPlayer } = context;

        return game.lobby.players.some((candidate) => {
            if (candidate.socketId === virtualPlayer.socketId || candidate.hasAbandonned) return false;
            if (!this.scanner.isOpponent(game, virtualPlayer, candidate)) return false;

            const pos = game.playerPositions.get(candidate.socketId);
            if (!pos) return false;
            if (pos.x === currentPos.x && pos.y === currentPos.y) return false;

            const distanceToDoor = Math.abs(pos.x - doorPos.x) + Math.abs(pos.y - doorPos.y);
            return distanceToDoor <= 1;
        });
    }

    // ----------
    // Sanctuary

    // Finds the first usable sanctuary along the path to a target.
    // If injured → healing, else if no combat bonus → combat.
    // Moves to sanctuary border, uses it, then continues.
    private tryClassicPathSanctuary(context: TurnContext, currentPos: Vec2, targetPos: Vec2): boolean {
        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const isInjured = virtualPlayer.character.life <= this.actionService.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.actionService.hasCombatBonus(game, virtualPlayer.socketId);

        // Try at current position first
        if (isInjured && this.actionService.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) {
            this.continueTurnAfterSanctuary(context);
            return true;
        }
        if (!hasCombatBonus && this.actionService.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary)) {
            this.continueTurnAfterSanctuary(context);
            return true;
        }

        // Find first sanctuary on path to target
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        const path = this.pathfindingService.reconstructPath(targetPos, dijkstraResult.predecessorKey);
        if (!path || path.length === 0) return false;

        const sanctuaryOnPath = this.actionService.findFirstReachableSanctuaryOnPath(context, path);
        if (!sanctuaryOnPath) return false;

        this.actionService.moveTowardThenActWithDoors(context, currentPos, sanctuaryOnPath.position, () => {
            this.actionService.tryUseSanctuaryAtCurrentPosition(context, sanctuaryOnPath.type);
            setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
        });
        return true;
    }

    // ----------
    // Turn flow

    private continueTurnAfterSanctuary(context: TurnContext): void {
        const remainingMovement = context.game.movementPoints.get(context.virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) {
            this.actionService.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        // Recheck AP after sanctuary use: if 0 enter post-combat movement phase
        const actionPoints = context.game.actionPoints.get(context.virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0 && remainingMovement > 0) {
            const currentPos = context.game.playerPositions.get(context.virtualPlayer.socketId);
            if (!currentPos) {
                this.actionService.endVirtualPlayerTurn(context.lobbyId);
                return;
            }

            setTimeout(() => {
                if (context.virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
                    this.runAggressivePostCombatMovement(context, currentPos);
                } else {
                    this.runDefensiveClassicTurn(context, currentPos);
                }
            }, this.actionService.getRandomActionDelay());
            return;
        }

        setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
    }

    private continueTurnAfterMovement(context: TurnContext): void {
        const remainingMovement = context.game.movementPoints.get(context.virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) {
            this.actionService.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        if (!this.canStillProgressThisTurn(context)) {
            this.actionService.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
    }

    private canStillProgressThisTurn(context: TurnContext): boolean {
        const { game, virtualPlayer } = context;
        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) return false;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // If a closed door is adjacent and AP is available, opening it is still meaningful
        if (actionPoints > 0) {
            const hasAdjacentClosedDoor = (Object.values(DIRECTION_OFFSETS) as Vec2[]).some((offset) => {
                const pos = { x: currentPos.x + offset.x, y: currentPos.y + offset.y };
                return game.lobby.game.grid[pos.y]?.[pos.x]?.type === TileTexture.DoorClosed;
            });
            if (hasAdjacentClosedDoor) return true;
        }

        const reachableTiles = this.pathfindingService.getReachableTilesWithinBudget(
            game,
            currentPos,
            remainingMovement,
            virtualPlayer.socketId,
            actionPoints > 0,
        );
        return reachableTiles.length > 0;
    }
}
