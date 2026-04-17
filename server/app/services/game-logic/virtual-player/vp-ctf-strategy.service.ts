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

    runCtfTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

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
                if (this.actionService.tryAttackAdjacentEnemy(context)) return;
                this.actionService.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        const flagOnGroundPos = this.scanner.findFlagOnMap(game);
        if (flagOnGroundPos) {
            const needsAp = this.actionService.ctfPathNeedsAp(game, virtualPlayer, currentPos, flagOnGroundPos);
            if (this.tryCtfPathSanctuary(context, currentPos, flagOnGroundPos, needsAp)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, flagOnGroundPos, () => {
                this.actionService.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        const enemyCarrier = this.scanner.findEnemyFlagCarrier(game, virtualPlayer);
        if (enemyCarrier) {
            const carrierPos = game.playerPositions.get(enemyCarrier.socketId);
            if (carrierPos) {
                this.runCtfCounterFlagplay(context, currentPos, enemyCarrier, carrierPos);
                return;
            }
        }

        const allyCarrier = this.scanner.findAllyFlagCarrier(game, virtualPlayer);
        if (allyCarrier) {
            this.runCtfAllyHasFlag(context, currentPos, allyCarrier);
            return;
        }

        this.classicStrategy.runClassicTurn(context, currentPos);
    }

    private runCtfCounterFlagplay(context: TurnContext, currentPos: Vec2, enemyCarrier: Player, carrierPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            const willReachCarrier = this.actionService.isEnemyReachableThisTurn(game, virtualPlayer, currentPos, carrierPos);
            const hasClosedDoor = this.actionService.hasClosedDoorOnPath(game, currentPos, carrierPos);
            if (this.tryCtfPathSanctuary(context, currentPos, carrierPos, hasClosedDoor || willReachCarrier)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, carrierPos, () => {
                const hasStartedCombat = this.actionService.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.actionService.endVirtualPlayerTurn(lobbyId);
            });
        } else {
            const carrierStartPos = game.playerStartPositions.get(enemyCarrier.socketId);
            const blockadeTarget = carrierStartPos
                ? this.scanner.findNearestFreePositionAround(game, carrierStartPos, virtualPlayer.socketId)
                : null;
            const target = blockadeTarget ?? carrierPos;
            const needsAp = this.actionService.ctfPathNeedsAp(game, virtualPlayer, currentPos, target);
            if (this.tryCtfPathSanctuary(context, currentPos, target, needsAp)) return;

            this.actionService.moveTowardThenActWithDoors(context, currentPos, target, () => {
                const hasStartedCombat = this.actionService.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.actionService.endVirtualPlayerTurn(lobbyId);
            });
        }
    }

    private runCtfAllyHasFlag(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { virtualPlayer } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runCtfAggressiveEscort(context, currentPos, allyCarrier);
        } else {
            this.runCtfDefensiveGuard(context, currentPos, allyCarrier);
        }
    }

    private runCtfDefensiveGuard(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { game, virtualPlayer, lobbyId } = context;

        const allySpawn = game.playerStartPositions.get(allyCarrier.socketId);
        if (!allySpawn) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

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

    private runCtfAggressiveEscort(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        if (actionPoints > 0 && this.actionService.tryAttackAdjacentEnemy(context)) return;

        const allyPos = game.playerPositions.get(allyCarrier.socketId);
        if (!allyPos) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const escortTarget = this.scanner.findNearestFreePositionAround(game, allyPos, virtualPlayer.socketId);
        if (!escortTarget) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const threatToAlly = this.scanner.findNearestEnemy(game, virtualPlayer, allyPos, true);
        const ESCORT_THREAT_DISTANCE = 3;
        const isThreatClose = threatToAlly && 
        (Math.abs(allyPos.x - threatToAlly.position.x) + 
        Math.abs(allyPos.y - threatToAlly.position.y) <= ESCORT_THREAT_DISTANCE);

        const finalTarget = isThreatClose ? threatToAlly.position : escortTarget;

        const hasClosedDoor = this.actionService.hasClosedDoorOnPath(game, currentPos, finalTarget);
        const hasAdjacentEnemy = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos).length > 0;
        if (this.tryCtfPathSanctuary(context, currentPos, finalTarget, hasClosedDoor || hasAdjacentEnemy)) return;

        this.actionService.moveTowardThenActWithDoors(context, currentPos, finalTarget, () => {
            if (this.actionService.tryAttackAdjacentEnemy(context)) return;
            this.actionService.endVirtualPlayerTurn(lobbyId);
        });
    }

    private tryCtfPathSanctuary(context: TurnContext, currentPos: Vec2, targetPos: Vec2, needsApForTarget: boolean): boolean {
        if (needsApForTarget) return false;

        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const isInjured = virtualPlayer.character.life <= this.actionService.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.actionService.hasCombatBonus(game, virtualPlayer.socketId);

        if (isInjured && this.actionService.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) {
            setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
            return true;
        }
        if (!hasCombatBonus && this.actionService.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary)) {
            setTimeout(() => context.continueDecisionCycle(), this.actionService.getRandomActionDelay());
            return true;
        }

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
