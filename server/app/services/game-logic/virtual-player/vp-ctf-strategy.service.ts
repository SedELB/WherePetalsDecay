import { TileItem, VirtualPlayerProfile } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Inject, Injectable } from '@nestjs/common';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';
import { HEALING_SANCTUARY_MIN_MISSING_HP, TurnContext, VPActionService } from './vp-action.service';
import { VPClassicStrategyService } from './vp-classic-strategy.service';

@Injectable()
export class VPCtfStrategyService {
    @Inject() private readonly actionService: VPActionService;
    @Inject() private readonly scanner: VirtualPlayerScannerService;
    @Inject() private readonly classicStrategy: VPClassicStrategyService;
    @Inject() private readonly gameLogicService: GameLogicService;
    @Inject() private readonly pathfindingService: VirtualPlayerPathfindingService;

    // --------
    // CTF mode

    runCtfTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        // Highest priority: return the flag to start position.
        if (virtualPlayer.hasFlag) {
            const startPos = game.playerStartPositions.get(virtualPlayer.socketId);
            if (!startPos) {
                this.actionService.endVirtualPlayerTurn(lobbyId);
                return;
            }
            const needsAp = this.actionService.ctfPathNeedsAp(game, virtualPlayer, currentPos, startPos);
            if (this.tryCtfPathSanctuary(context, currentPos, startPos, needsAp)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, startPos, () => {
                const pos = game.playerPositions.get(virtualPlayer.socketId);
                if (pos) {
                    const winner = this.gameLogicService.checkWinCondition(lobbyId, virtualPlayer.socketId, pos);
                    if (winner) {
                        context.onGameEnded(lobbyId, winner.socketId);
                        return;
                    }
                }
                // if an enemy blocking the spawn, attack them to clear the path
                if (this.actionService.tryAttackAdjacentEnemy(context)) return;
                this.actionService.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        // Flag is on the ground
        const flagOnGroundPos = this.scanner.findFlagOnMap(game);
        if (flagOnGroundPos) {
            const needsAp = this.actionService.ctfPathNeedsAp(game, virtualPlayer, currentPos, flagOnGroundPos);
            if (this.tryCtfPathSanctuary(context, currentPos, flagOnGroundPos, needsAp)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, flagOnGroundPos, () => {
                // VP just races to pick it up
                this.actionService.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        // Flag is held by an enemy
        const enemyCarrier = this.scanner.findEnemyFlagCarrier(game, virtualPlayer);
        if (enemyCarrier) {
            const carrierPos = game.playerPositions.get(enemyCarrier.socketId);
            if (carrierPos) {
                this.runCtfCounterFlagplay(context, currentPos, enemyCarrier, carrierPos);
                return;
            }
        }

        // Flag is held by an ally
        const allyCarrier = this.scanner.findAllyFlagCarrier(game, virtualPlayer);
        if (allyCarrier) {
            this.runCtfAllyHasFlag(context, currentPos, allyCarrier);
            return;
        }

        // No flag anywhere relevant – fall back to classic profile behaviour.
        this.classicStrategy.runClassicTurn(context, currentPos);
    }

    private runCtfCounterFlagplay(context: TurnContext, currentPos: Vec2, enemyCarrier: Player, carrierPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            // Aggressive: chase the carrier. Need AP only if VP will reach the carrier this turn or there's a door.
            const willReachCarrier = this.actionService.isEnemyReachableThisTurn(game, virtualPlayer, currentPos, carrierPos);
            const hasClosedDoor = this.actionService.hasClosedDoorOnPath(game, currentPos, carrierPos);
            if (this.tryCtfPathSanctuary(context, currentPos, carrierPos, hasClosedDoor || willReachCarrier)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, carrierPos, () => {
                const hasStartedCombat = this.actionService.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.actionService.endVirtualPlayerTurn(lobbyId);
            });
        } else {
            // Defensive: block the carrier's start position.
            const carrierStartPos = game.playerStartPositions.get(enemyCarrier.socketId);
            const blockadeTarget = carrierStartPos
                ? this.scanner.findNearestFreePositionAround(game, carrierStartPos, virtualPlayer.socketId)
                : null;
            const target = blockadeTarget ?? carrierPos;
            const needsAp = this.actionService.ctfPathNeedsAp(game, virtualPlayer, currentPos, target);
            if (this.tryCtfPathSanctuary(context, currentPos, target, needsAp)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, target, () => {
                // Only attack an enemy that is blocking the carrier's spawn position
                if (carrierStartPos) {
                    const vpPosNow = game.playerPositions.get(virtualPlayer.socketId) ?? currentPos;
                    const adjacentEnemies = this.scanner.getAdjacentOpponents(game, virtualPlayer, vpPosNow);
                    const enemyOnSpawn = adjacentEnemies.find((e) => {
                        const ePos = game.playerPositions.get(e.socketId);
                        return ePos && ePos.x === carrierStartPos.x && ePos.y === carrierStartPos.y;
                    });
                    if (enemyOnSpawn) {
                        virtualPlayer.character.bonusPosture = this.actionService.postureForProfile(virtualPlayer.virtualProfile);
                        context.startCombat(lobbyId, virtualPlayer.socketId, enemyOnSpawn.socketId);
                        return;
                    }
                }
                this.actionService.endVirtualPlayerTurn(lobbyId);
            });
        }
    }

    // --------
    // CTF ally-has-flag behaviour

    private runCtfAllyHasFlag(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { virtualPlayer } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runCtfAggressiveEscort(context, currentPos, allyCarrier);
        } else {
            this.runCtfDefensiveGuard(context, currentPos, allyCarrier);
        }
    }

    // Defensive: guard the ally's spawn – never proactively attack
    private runCtfDefensiveGuard(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { game, virtualPlayer, lobbyId } = context;

        const allySpawn = game.playerStartPositions.get(allyCarrier.socketId);
        if (!allySpawn) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        // Move to the ally's spawn area and hold position – no combat
        const guardTarget = this.scanner.findNearestFreePositionAround(game, allySpawn, virtualPlayer.socketId);
        if (guardTarget && (guardTarget.x !== currentPos.x || guardTarget.y !== currentPos.y)) {
            const hasClosedDoor = this.actionService.hasClosedDoorOnPath(game, currentPos, guardTarget);
            if (this.tryCtfPathSanctuary(context, currentPos, guardTarget, hasClosedDoor)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, guardTarget, () => {
                this.actionService.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        this.actionService.endVirtualPlayerTurn(lobbyId);
    }

    // Aggressive: escort the ally
    //   - Move toward the ally's current position
    //   - Attack any adjacent enemy encountered along the way
    //   - Continue approaching after combat
    //   - End turn when 0 AP and 0 MP
    private runCtfAggressiveEscort(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // If adjacent to an enemy and has AP, attack before moving (AP needed for combat)
        if (actionPoints > 0 && this.actionService.tryAttackAdjacentEnemy(context)) return;

        const allyPos = game.playerPositions.get(allyCarrier.socketId);
        if (!allyPos) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        // No adjacent enemy – try sanctuary on the way to the ally
        const hasClosedDoor = this.actionService.hasClosedDoorOnPath(game, currentPos, allyPos);
        const hasAdjacentEnemy = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos).length > 0;
        if (this.tryCtfPathSanctuary(context, currentPos, allyPos, hasClosedDoor || hasAdjacentEnemy)) return;

        this.actionService.moveTowardThenActWithDoors(context, currentPos, allyPos, () => {
            if (this.actionService.tryAttackAdjacentEnemy(context)) return;
            this.actionService.endVirtualPlayerTurn(lobbyId);
        });
    }

    // Helper: move back toward spawn area after an interception, then end turn
    private moveBackToSpawnArea(context: TurnContext, spawnPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        const remainingMp = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (!currentPos || remainingMp <= 0) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const returnTarget = this.scanner.findNearestFreePositionAround(game, spawnPos, virtualPlayer.socketId);
        if (returnTarget && (returnTarget.x !== currentPos.x || returnTarget.y !== currentPos.y)) {
            this.actionService.moveTowardThenActWithDoors(context, currentPos, returnTarget, () => this.actionService.endVirtualPlayerTurn(lobbyId));
        } else {
            this.actionService.endVirtualPlayerTurn(lobbyId);
        }
    }

    // --------
    // CTF sanctuary helpers

    // Attempts to use the first sanctuary along the CTF path.
    // Returns true if sanctuary usage was initiated (caller should return).
    private tryCtfPathSanctuary(context: TurnContext, currentPos: Vec2, targetPos: Vec2, needsApForTarget: boolean): boolean {
        if (needsApForTarget) return false;

        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const isInjured = virtualPlayer.character.life <= this.actionService.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.actionService.hasCombatBonus(game, virtualPlayer.socketId);

        // Priority 1: use sanctuary at current position
        if (isInjured && this.actionService.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) {
            setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
            return true;
        }
        if (!hasCombatBonus && this.actionService.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary)) {
            setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
            return true;
        }

        // Priority 2: find the first sanctuary border on the reachable path to the target
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
}
