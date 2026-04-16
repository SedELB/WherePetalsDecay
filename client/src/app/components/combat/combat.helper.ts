import { PostureType } from '@common/enums';
import { Vec2 } from '@common/vec2';

export const POSTURE_BONUS = 2;
export const TOAST_DEFAULT_TIMER = 2200;
export const START_TOAST_TIMER = 3600;
export const ROUND_RESULT_TOAST_TIMER = 4200;
export const COMBAT_ATTACK_ANIMATION_DEFAULT_MS = 1000;
export const COMBAT_ANIMATION_PHASE_COUNT = 6;
export const COMBAT_ANIMATION_DEFENDER_STEP_MULTIPLIER = 3;
export const COMBAT_ANIMATION_DEFENDER_HIT_MULTIPLIER = 4;
export const COMBAT_ANIMATION_DEFENDER_BACK_MULTIPLIER = 5;
export const COMBAT_ANIMATION_RESET_MULTIPLIER = 6;
export const COMBAT_ANIMATION_MIN_STEP_MS = 80;
export const TILE_CENTER_OFFSET = 0.5;
export const TO_PERCENT = 100;

export type TypePosture = PostureType | null;

export interface DetailedStatLine {
    base: number;
    postureBonus: number;
    dice: number;
    penalty: number;
    total: number;
}

export interface FighterDetailedResult {
    attack: DetailedStatLine;
    defense: DetailedStatLine;
}

export interface RoundDetailedResult {
    player: FighterDetailedResult;
    enemy: FighterDetailedResult;
    damageDealt: number;
    damageReceived: number;
    rollIndex: number;
}

export function getBaseCombatPositions(enemySocketId: string, playerSocketId: string): Record<string, Vec2> {
    return {
        [enemySocketId]: { x: 1, y: 0 },
        [playerSocketId]: { x: 1, y: 2 },
    };
}

export function computeLungePosition(attackerPosition: Vec2, defenderPosition: Vec2): Vec2 {
    const deltaX = defenderPosition.x - attackerPosition.x;
    const deltaY = defenderPosition.y - attackerPosition.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        return {
            x: attackerPosition.x + Math.sign(deltaX),
            y: attackerPosition.y,
        };
    }

    return {
        x: attackerPosition.x,
        y: attackerPosition.y + Math.sign(deltaY),
    };
}
