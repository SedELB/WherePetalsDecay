import { Injectable } from '@nestjs/common';
import { Player } from '@common/player';
import { GameMode, VirtualPlayerProfile } from '@common/enums';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
import { VP_CONSTANTS } from '@app/constants/game-logic.constants';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';
import { TurnContext } from '@app/interfaces/virtual-player.interface';
import { Posture } from '@common/character';

@Injectable()
export class VirtualPlayerCombatService {
    constructor(readonly scanner: VirtualPlayerScannerService) {}

    /**
     * Picks the best adjacent opponent and initiates combat.
     * Returns 'true' if combat was initiated.
     */
    tryAttackAdjacentEnemy(context: TurnContext): boolean {
        const { game, virtualPlayer, lobbyId, startCombat } = context;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const adjacentEnemies = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos);
        if (adjacentEnemies.length === 0) return false;

        const target = this.selectBestAttackTarget(adjacentEnemies, game, virtualPlayer);

        // Pre-select the VP's posture before combat so CombatService uses the right bonus.
        virtualPlayer.character.bonusPosture = this.postureForProfile(virtualPlayer.virtualProfile);

        startCombat(lobbyId, virtualPlayer.socketId, target.socketId);
        return true;
    }

    /**
     * In CTF aggressive mode, prefers attacking the enemy carrying the flag.
     * Otherwise targets the enemy with the least remaining HP.
     */
    private selectBestAttackTarget(candidates: Player[], game: ActiveGame, virtualPlayer: Player): Player {
        const preferFlagCarrier =
            game.lobby.game.gameMode === GameMode.Ctf && virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive;

        if (preferFlagCarrier) {
            const flagCarrier = candidates.find((p) => p.hasFlag);
            if (flagCarrier) return flagCarrier;
        }

        return candidates.reduce((weakest, current) => (current.character.life < weakest.character.life ? current : weakest));
    }

    private postureForProfile(profile: VirtualPlayerProfile): Posture {
        return profile === VirtualPlayerProfile.Aggressive ? VP_CONSTANTS.aggressivePosture : VP_CONSTANTS.defensivePosture;
    }
}
