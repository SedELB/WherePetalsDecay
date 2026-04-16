
// Virtual Player constants
export const VP_CONSTANTS = {
    minActionDelayMs: 1000,
    extraActionDelayMs: 2000,
    stepDelayMs: 300,
    healingSanctuaryMinMissingHp: 2,
    aggressivePosture: { type: 'atk', bonus: 2 } as const,
    defensivePosture: { type: 'def', bonus: 2 } as const,
    eventPlayerMoved: 'playerMoved',
    eventDoorToggled: 'doorToggled',
    eventActionPoints: 'actionPoints',
};

// Sanctuary constants
export const SANCTUARY_CONSTANTS = {
    cooldownTurns: 2,
    healAmount: 2,
    combatBonus: 1,
    doubleOrNothingChance: 0.5,
};

// Combat constants
export const COMBAT_CONSTANTS = {
    postureBonusValue: 2,
    icePenaltyValue: 2,
    diceFaceIndex: 1,
    diceMinValue: 1,
};

export const VIRTUAL_PLAYER_ID_BASE = 1000;
export const RANDOM_THRESHOLD = 0.5;
export const HALF_CHANCE = 0.5;
export const VIRTUAL_INITIAL_WINS_COUNT = 0;
