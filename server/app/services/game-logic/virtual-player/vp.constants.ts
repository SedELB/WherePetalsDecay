import { PostureType } from '@common/enums';
import { Posture } from '@common/character';

export const VP_ACTION_DELAY_MIN_MS = 1000;
export const VP_ACTION_DELAY_MAX_MS = 2500;
export const VP_TURN_START_DELAY_MIN_MS = 3000;
export const VP_TURN_START_DELAY_MAX_MS = 5500;
export const VP_STEP_DELAY_MIN_MS = 200;
export const VP_STEP_DELAY_MAX_MS = 500;
export const HEALING_SANCTUARY_MIN_MISSING_HP = 2;

export const AGGRESSIVE_POSTURE: Posture = { type: PostureType.Attack, bonus: 2 };
export const DEFENSIVE_POSTURE: Posture = { type: PostureType.Defense, bonus: 2 };

export const EVENT_PLAYER_MOVED = 'playerMoved';
export const EVENT_DOOR_TOGGLED = 'doorToggled';
export const EVENT_ACTION_POINTS = 'actionPoints';
export const EVENT_SANCTUARY_USED = 'sanctuaryUsed';
export const EVENT_PLAYER_STATS_UPDATE = 'playerStatsUpdate';
