import { TileTexture } from '@common/enums';

export const POSTURE_BONUS = 2;

export const COMBAT_TOAST_DEFAULT_DURATION_MS = 2200;

export const TILE_CENTER_OFFSET = 0.5;
export const TO_PERCENT = 100;
export const DICE_ROLL_TICK_MS = 90;
export const DEFAULT_DICE_FACES = 6;

/** For the smooth animation in combat interface (by Codex 5.3) */
export const EASE_PROGRESS_MIDDLE_POINT = 0.5;
export const EASE_ACCELERATION_FACTOR = 4;
export const EASE_DECELERATION_FACTOR = -2;
export const EASE_POWER = 3;
export const EASE_DIVISOR = 2;
export const EASE_DECELERATION_OFFSET = 2;

/** For the smooth animation of the damage pop up (by Codex 5.3) */
export const IMPACT_POPUP_DEFAULT_GRID_DIMENSION = 3;
export const IMPACT_POPUP_TILE_CENTER_OFFSET = 0.5;
export const IMPACT_POPUP_MIN_PERCENT = 5;
export const IMPACT_POPUP_MAX_PERCENT = 95;
export const IMPACT_POPUP_VERTICAL_OFFSET_PERCENT = 12;
export const IMPACT_POPUP_PLAYER_TILT_DEG = 12;
export const IMPACT_POPUP_ENEMY_TILT_DEG = -12;
export const IMPACT_POPUP_DURATION_MS = 900;
export const IMPACT_POPUP_COMBAT_MAP_WIDTH_PX = 520;
export const IMPACT_POPUP_COMBAT_MAP_HEIGHT_PX = 450;
export const IMPACT_POPUP_AVATAR_VERTICAL_OFFSET_TILE_WIDTH_RATIO = 0.5;
export const IMPACT_POPUP_ADDITIONAL_VERTICAL_OFFSET_PX = 70;

export const DICE_ROLL_DURATION_MS = 1000;
export const DICE_RESULT_DISPLAY_MS = 500;
export const ROUND_PHASE_DELAY_MS = 500;
export const DAMAGE_POPUP_DURATION_MS = 1000;
export const ROUND_ANNOUNCEMENT_DURATION_MS = 1000;
export const FIGHTER_MOVEMENT_DURATION_MS = 200;
export const FIGHTER_IMPACT_DELAY_MS = 100;
export const COMBAT_END_POPUP_DURATION_MS = 3000;

const COMBAT_FLOOR_TILE = { type: TileTexture.Floor, item: null };
const COMBAT_WATER_TILE = { type: TileTexture.Water, item: null };
export const COMBAT_MAP_LAYOUT = [
    [COMBAT_FLOOR_TILE, COMBAT_WATER_TILE, COMBAT_FLOOR_TILE],
    [COMBAT_FLOOR_TILE, COMBAT_WATER_TILE, COMBAT_FLOOR_TILE],
    [COMBAT_FLOOR_TILE, COMBAT_WATER_TILE, COMBAT_FLOOR_TILE],
];
