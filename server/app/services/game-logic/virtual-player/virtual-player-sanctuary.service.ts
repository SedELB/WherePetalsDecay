import { Injectable } from '@nestjs/common';
import { Vec2 } from '@common/vec2';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
import { Player } from '@common/player';
import { TileItem, SanctuaryMode } from '@common/enums';
import { VP_CONSTANTS } from '@app/constants/game-logic.constants';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { TurnContext } from '@app/interfaces/virtual-player.interface';
import { BASE_STATS } from '@common/constants/character.constants';
import { SanctuaryType } from '@common/tile';

@Injectable()
export class VirtualPlayerSanctuaryService {
    constructor(
        private readonly gameLogicService: GameLogicService,
        private readonly scanner: VirtualPlayerScannerService,
        private readonly pathfindingService: VirtualPlayerPathfindingService,
    ) {}

    /**
     * Attempts to use a sanctuary at the VP's current position.
     * Healing sanctuaries are prioritized if injured.
     */
    tryUseSanctuaryAtCurrentPosition(context: TurnContext, sanctuaryType: SanctuaryType): boolean {
        const { game, virtualPlayer, lobbyId } = context;

        if (sanctuaryType === TileItem.HealingSanctuary) {
            if (!this.isInjured(virtualPlayer)) return false;
        }

        if (sanctuaryType === TileItem.CombatSanctuary && this.hasCombatBonus(game, virtualPlayer.socketId)) {
            return false;
        }

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const sanctuaryPos = this.findAdjacentSanctuaryPosition(game, currentPos, sanctuaryType);
        if (!sanctuaryPos) return false;

        const useResult = this.gameLogicService.useSanctuary(lobbyId, virtualPlayer.socketId, sanctuaryPos, SanctuaryMode.Normal);
        return Boolean(useResult);
    }

    /**
     * Finds a reachable sanctuary and moves toward it to use it.
     */
    tryMoveAndUseSanctuary(
        context: TurnContext,
        currentPos: Vec2,
        sanctuaryType: SanctuaryType,
        handlers: {
            moveTowardThenActWithDoors: (context: TurnContext, currentPos: Vec2, targetPos: Vec2, onDone: () => void) => void;
            continueTurnAfterSanctuary: (context: TurnContext) => void;
            continueTurnAfterMovement: (context: TurnContext) => void;
            runDecisionCycle?: (context: TurnContext) => void;
        },
    ): boolean {
        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        if (sanctuaryType === TileItem.HealingSanctuary && !this.isInjured(virtualPlayer)) {
            return false;
        }

        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos);

        const border = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
            sanctuaryType,
            reachableThisTurn: true,
            precomputedCostToPosition: costToPosition,
        });
        if (!border) return false;

        const { moveTowardThenActWithDoors, continueTurnAfterSanctuary, continueTurnAfterMovement } = handlers;
        moveTowardThenActWithDoors(context, currentPos, border, () => {
            const used = this.tryUseSanctuaryAtCurrentPosition(context, sanctuaryType);
            if (used) {
                continueTurnAfterSanctuary(context);
            } else {
                continueTurnAfterMovement(context);
            }
        });
        return true;
    }

    private findAdjacentSanctuaryPosition(game: ActiveGame, currentPos: Vec2, sanctuaryType: SanctuaryType): Vec2 | null {
        const candidatesPos: Vec2[] = [
            { x: currentPos.x, y: currentPos.y - 1 },
            { x: currentPos.x - 1, y: currentPos.y },
            { x: currentPos.x, y: currentPos.y + 1 },
            { x: currentPos.x + 1, y: currentPos.y },
        ];

        for (const pos of candidatesPos) {
            const tile = game.lobby.game.grid[pos.y]?.[pos.x];
            if (tile?.item === sanctuaryType) return pos;
        }

        return null;
    }

    isInjured(player: Player): boolean {
        return player.character.life <= this.getMaxLife(player) - VP_CONSTANTS.healingSanctuaryMinMissingHp;
    }

    getMaxLife(player: Player): number {
        return player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    }

    hasCombatBonus(game: ActiveGame, socketId: string): boolean {
        return game.playerCombatBonuses.has(socketId);
    }
}
