import { Injectable } from '@nestjs/common';
import { Direction } from '@common/direction';
import { SanctuaryMode } from '@common/enums';
import { Vec2 } from '@common/vec2';
import { ActiveGame } from './active-game.interface';
import { MovementService } from './movement.service';
import { CombatService } from './combat.service';
import { SanctuaryService } from './sanctuary.service';
import { SanctuaryUseResult } from '@app/interfaces/sanctuary.interface';

@Injectable()
export class GameActionService {
    constructor(
        private readonly movementService: MovementService,
        private readonly combatService: CombatService,
        private readonly sanctuaryService: SanctuaryService,
    ) {}

    movePlayer(game: ActiveGame, socketId: string, direction: Direction): Vec2 | null {
        return this.movementService.movePlayer(game, socketId, direction);
    }

    teleportPlayer(game: ActiveGame, socketId: string, targetPos: Vec2): Vec2 | null {
        return this.movementService.teleportPlayer(game, socketId, targetPos);
    }

    getReachableTilesForTeleport(game: ActiveGame): Vec2[] {
        return this.movementService.getReachableTilesForTeleport(game);
    }

    getReachableTiles(game: ActiveGame, socketId: string): Vec2[] {
        return this.movementService.getReachableTiles(game, socketId);
    }

    getMovementPoints(game: ActiveGame, socketId: string): number {
        return this.movementService.getMovementPoints(game, socketId);
    }

    getAdjacentPlayers(game: ActiveGame, socketId: string) {
        return this.combatService.getAdjacentPlayers(game, socketId);
    }

    initiateCombat(
        game: ActiveGame,
        attackerId: string,
        defenderId: string,
        consumeActionPoint: boolean,
        diceStrategy?: { attacker: 'max' | 'min'; defender: 'max' | 'min' },
    ) {
        return this.combatService.initiateCombat(game, attackerId, defenderId, consumeActionPoint, diceStrategy);
    }

    checkCombatWinCondition(game: ActiveGame) {
        return this.combatService.checkWinCondition(game);
    }

    useSanctuary(game: ActiveGame, socketId: string, position: Vec2, mode: SanctuaryMode): SanctuaryUseResult | null {
        return this.sanctuaryService.useSanctuary(game, socketId, position, mode);
    }

    decrementSanctuaryCooldowns(game: ActiveGame, endedSocketId: string): string[] {
        return this.sanctuaryService.decrementSanctuaryCooldowns(game, endedSocketId);
    }

    computeInactiveSanctuaries(game: ActiveGame): Vec2[] {
        return this.sanctuaryService.computeInactiveSanctuaries(game);
    }
}
