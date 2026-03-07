import { Player } from './player';
import { Vec2 } from './vec2';

export interface GamePlayer extends Player {
    position: Vec2;
    startPosition: Vec2;
    movementPoints: number;
    victories: number;
    isActive: boolean;
    hasCombatted: boolean;
}
