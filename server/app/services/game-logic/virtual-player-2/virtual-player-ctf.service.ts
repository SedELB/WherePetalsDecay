import { Injectable } from '@nestjs/common';
import { Vec2 } from '@common/vec2';
import { VirtualPlayerProfile } from '@common/enums';
import { TurnContext } from '@app/interfaces/virtual-player.interface';
import { VirtualPlayerActionService } from './virtual-player-action.service';

@Injectable()
export class VirtualPlayerCtfService {
    constructor(
        private readonly action: VirtualPlayerActionService,
    ) {}

    runCtfTurn(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
        runDecisionCycle: (context: TurnContext) => void;
    }): void {
        const { virtualPlayer } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runAggressiveCtf(context, currentPos, handlers);
        } else {
            this.runDefensiveCtf(context, currentPos, handlers);
        }
    }

    private runAggressiveCtf(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
        runDecisionCycle: (context: TurnContext) => void;
    }): void {
        const { game, virtualPlayer } = context;
        if (virtualPlayer.hasFlag) {
            this.goHome(context, currentPos, handlers);
            return;
        }

        const enemyCarrier = this.action.combat.scanner.findEnemyFlagCarrier(game, virtualPlayer);
        if (enemyCarrier) {
            const pos = game.playerPositions.get(enemyCarrier.socketId);
            if (pos) {
                handlers.moveTowardThenActWithDoors(context, currentPos, pos, () => {
                    const started = handlers.tryAttackAdjacentEnemy(context);
                    if (!started) handlers.endVirtualPlayerTurn(context.lobbyId);
                });
                return;
            }
        }

        const flagPos = this.action.combat.scanner.findFlagOnMap(game);
        if (flagPos) {
            handlers.moveTowardThenActWithDoors(context, currentPos, flagPos, () => {
                handlers.runDecisionCycle(context);
            });
            return;
        }

        handlers.endVirtualPlayerTurn(context.lobbyId);
    }

    private runDefensiveCtf(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
        runDecisionCycle: (context: TurnContext) => void;
    }): void {
        const { game, virtualPlayer } = context;
        if (virtualPlayer.hasFlag) {
            this.goHome(context, currentPos, handlers);
            return;
        }

        const allyCarrier = this.action.combat.scanner.findAllyFlagCarrier(game, virtualPlayer);
        if (allyCarrier) {
            const pos = game.playerPositions.get(allyCarrier.socketId);
            if (pos) {
                handlers.moveTowardThenActWithDoors(context, currentPos, pos, () => {
                    handlers.endVirtualPlayerTurn(context.lobbyId);
                });
                return;
            }
        }

        this.runAggressiveCtf(context, currentPos, handlers);
    }

    private goHome(context: TurnContext, currentPos: Vec2, handlers: {
        moveTowardThenActWithDoors: (context: TurnContext, from: Vec2, to: Vec2, onDone: () => void) => void;
        tryAttackAdjacentEnemy: (context: TurnContext) => boolean;
        endVirtualPlayerTurn: (lobbyId: string) => void;
        runDecisionCycle: (context: TurnContext) => void;
    }): void {
        const spawnPos = context.game.playerStartPositions.get(context.virtualPlayer.socketId);
        if (spawnPos) {
            handlers.moveTowardThenActWithDoors(context, currentPos, spawnPos, () => {
                handlers.runDecisionCycle(context);
            });
        } else {
            handlers.endVirtualPlayerTurn(context.lobbyId);
        }
    }
}
