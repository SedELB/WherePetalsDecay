import { Injectable } from '@nestjs/common';
import { BASE_STATS } from '@common/constants/character.constants';
import { Vec2 } from '@common/vec2';
import { VirtualPlayerProfile, TileItem } from '@common/enums';
import { TurnContext } from '@app/interfaces/virtual-player.interface';
import { VirtualPlayerActionService } from './virtual-player-action.service';
import { VP_CONSTANTS } from '@app/constants/game-logic.constants';

@Injectable()
export class VirtualPlayerProfileService {
    constructor(
        private readonly action: VirtualPlayerActionService,
    ) {}

    runClassicTurn(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
    }): void {
        const { virtualPlayer } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runAggressiveClassic(context, currentPos, handlers);
        } else {
            this.runDefensiveClassic(context, currentPos, handlers);
        }
    }

    private runAggressiveClassic(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
    }): void {
        const nearestEnemy = this.action.combat.scanner.findNearestEnemy(context.game, context.virtualPlayer, currentPos, true);
        if (!nearestEnemy) {
            handlers.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        handlers.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
            const hasStartedCombat = handlers.tryAttackAdjacentEnemy(context);
            if (!hasStartedCombat) handlers.endVirtualPlayerTurn(context.lobbyId);
        });
    }

    private runDefensiveClassic(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
    }): void {
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
}
