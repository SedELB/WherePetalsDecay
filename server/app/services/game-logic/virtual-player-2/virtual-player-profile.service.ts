import { Inject, Injectable } from '@nestjs/common';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { TileTexture, VirtualPlayerProfile, TileItem } from '@common/enums';
import { SanctuaryType } from '@common/tile';
import { Vec2 } from '@common/vec2';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
import { Player } from '@common/player';
import { TurnContext } from '@app/interfaces/virtual-player.interface';
import { VirtualPlayerActionService } from './virtual-player-action.service';
import { VP_CONSTANTS } from '@app/constants/game-logic.constants';

type ClassicHandlers = {
    moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
    tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
    endVirtualPlayerTurn: (lobbyId: string) => void;
};

@Injectable()
export class VirtualPlayerProfileService {
    @Inject() private readonly action: VirtualPlayerActionService;

    runClassicTurn(context: TurnContext, currentPos: Vec2, handlers: ClassicHandlers): void {
        const { virtualPlayer } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runAggressiveClassic(context, currentPos, handlers);
        } else {
            this.runDefensiveClassic(context, currentPos, handlers);
        }
    }

    // Aggressive classic:
    //   1. Adjacent enemy → attack immediately
    //   2. Enemy reachable this turn → move toward + attack
    //   3. Enemy NOT reachable:
    //      a. Door on path → move toward enemy (save AP for door)
    //      b. No door → check sanctuary on path, then move toward enemy
    private runAggressiveClassic(context: TurnContext, currentPos: Vec2, handlers: ClassicHandlers): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        if (actionPoints <= 0) {
            const postCombatEnemy = this.action.combat.scanner.findNearestEnemy(game, virtualPlayer, currentPos, true);
            if (postCombatEnemy) {
                handlers.moveTowardThenActWithDoors(context, currentPos, postCombatEnemy.position, () => {
                    const hasStartedCombat = handlers.tryAttackAdjacentEnemy(context);
                    if (!hasStartedCombat) handlers.endVirtualPlayerTurn(lobbyId);
                });
            } else {
                handlers.endVirtualPlayerTurn(lobbyId);
            }
            return;
        }

        if (handlers.tryAttackAdjacentEnemy(context)) return;

        const nearestEnemy = this.action.combat.scanner.findNearestEnemy(game, virtualPlayer, currentPos, true);
        if (!nearestEnemy) {
            handlers.endVirtualPlayerTurn(lobbyId);
            return;
        }

        if (this.isEnemyReachableThisTurn(game, virtualPlayer, currentPos, nearestEnemy.position)) {
            handlers.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
                const hasStartedCombat = handlers.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) handlers.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        const hasDoorOnPath = this.hasClosedDoorOnPath(game, currentPos, nearestEnemy.position);
        if (!hasDoorOnPath) {
            const usedSanctuary = this.trySanctuaryOnPath(context, currentPos, nearestEnemy.position, handlers);
            if (usedSanctuary) return;
        }

        handlers.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
            const hasStartedCombat = handlers.tryAttackAdjacentEnemy(context);
            if (!hasStartedCombat) handlers.endVirtualPlayerTurn(lobbyId);
        });
    }

    private runDefensiveClassic(context: TurnContext, currentPos: Vec2, handlers: ClassicHandlers): void {
        const { game, virtualPlayer } = context;
        const maxLifeBonus = BASE_STATS.life + BASE_STATS.bonus;
        const maxLife = virtualPlayer.character.lifeBonus ? maxLifeBonus : BASE_STATS.life;
        const isInjured = virtualPlayer.character.life <= maxLife - VP_CONSTANTS.healingSanctuaryMinMissingHp;

        const noOp = () => { /* flow managed by caller */ };
        if (isInjured && this.action.sanctuary.tryMoveAndUseSanctuary(
            context, currentPos, TileItem.HealingSanctuary, {
                moveTowardThenActWithDoors: handlers.moveTowardThenActWithDoors,
                continueTurnAfterSanctuary: noOp,
                continueTurnAfterMovement: noOp,
            },
        )) return;

        const needsCombatBonus = !this.action.sanctuary.hasCombatBonus(game, virtualPlayer.socketId);
        if (needsCombatBonus && this.action.sanctuary.tryMoveAndUseSanctuary(
            context, currentPos, TileItem.CombatSanctuary, {
                moveTowardThenActWithDoors: handlers.moveTowardThenActWithDoors,
                continueTurnAfterSanctuary: noOp,
                continueTurnAfterMovement: noOp,
            },
        )) return;

        this.runAggressiveClassic(context, currentPos, handlers);
    }

    private isEnemyReachableThisTurn(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2, enemyPos: Vec2): boolean {
        const remainingMp = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const { costToPosition } = this.action.pathfinding.computeFullDijkstra(game, currentPos, true);
        return (Object.values(DIRECTION_OFFSETS) as Vec2[]).some((offset) => {
            const adj = { x: enemyPos.x + offset.x, y: enemyPos.y + offset.y };
            const cost = costToPosition.get(this.action.pathfinding.positionKey(adj)) ?? Infinity;
            return cost <= remainingMp;
        });
    }

    private hasClosedDoorOnPath(game: ActiveGame, currentPos: Vec2, targetPos: Vec2): boolean {
        const dijkstraResult = this.action.pathfinding.computeFullDijkstra(game, currentPos, true);
        const path = this.action.pathfinding.reconstructPath(targetPos, dijkstraResult.predecessorKey);
        if (!path) return false;
        return path.some((step) => game.lobby.game.grid[step.y]?.[step.x]?.type === TileTexture.DoorClosed);
    }

    private trySanctuaryOnPath(context: TurnContext, currentPos: Vec2, targetPos: Vec2, handlers: ClassicHandlers): boolean {
        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const maxLifeBonus = BASE_STATS.life + BASE_STATS.bonus;
        const maxLife = virtualPlayer.character.lifeBonus ? maxLifeBonus : BASE_STATS.life;
        const isInjured = virtualPlayer.character.life <= maxLife - VP_CONSTANTS.healingSanctuaryMinMissingHp;
        const hasCombatBonus = this.action.sanctuary.hasCombatBonus(game, virtualPlayer.socketId);

        if (isInjured && this.action.sanctuary.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) return true;
        if (!hasCombatBonus && this.action.sanctuary.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary)) return true;

        const dijkstraResult = this.action.pathfinding.computeFullDijkstra(game, currentPos, true);
        const path = this.action.pathfinding.reconstructPath(targetPos, dijkstraResult.predecessorKey);
        if (!path || path.length === 0) return false;

        const noOp = () => { /* flow managed by caller */ };
        const sanctuaryTypes: SanctuaryType[] = isInjured
            ? [TileItem.HealingSanctuary]
            : (!hasCombatBonus ? [TileItem.CombatSanctuary] : []);

        for (const sanctuaryType of sanctuaryTypes) {
            if (this.action.sanctuary.tryMoveAndUseSanctuary(context, currentPos, sanctuaryType, {
                moveTowardThenActWithDoors: handlers.moveTowardThenActWithDoors,
                continueTurnAfterSanctuary: noOp,
                continueTurnAfterMovement: noOp,
            })) return true;
        }
        return false;
    }
}
