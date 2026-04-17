import { SanctuaryMode, TileItem } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';

export interface SanctuaryUseResult {
    success: boolean;
    sanctuaryType: TileItem.HealingSanctuary | TileItem.CombatSanctuary;
    mode: SanctuaryMode;
    healAmount: number;
    combatBonusApplied: boolean;
    playerNewLife: number;
    playerName: string;
    inactiveSanctuaries: { x: number; y: number }[];
}

export interface SanctuaryValidation {
    player: Player;
    topLeft: Vec2;
    sanctuaryType: TileItem.HealingSanctuary | TileItem.CombatSanctuary;
}

export interface CombatEffectParams {
    game: ActiveGame;
    socketId: string;
    player: Player;
    mode: SanctuaryMode;
}
