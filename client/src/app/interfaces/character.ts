export interface Character {
    name: string;
    avatar: string;
    life: number;
    speed: number;
    attack: number;
    defense: number;
    lifeBonus: boolean;
    attackDice: 'D4' | 'D6';
    defenseDice: 'D4' | 'D6';
}


export const BASE_STATS = {
    life: 6,
    speed: 6,
    attack: 4,
    defense: 4,
    bonus: 2,
};

const BASE_AVATAR_PATH = 'assets/avatars';

export const AVATARS_PATH: readonly string[] = [
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/filler.png`,
    `${BASE_AVATAR_PATH}/naruto.svg`,
] as const;

export const RANDOM_NAMES: readonly string[] = [
    'Shadowblade',
    'Ironheart',
    'Stormwalker',
    'Nightwhisper',
    'Flamebringer',
    'Frostborn',
    'Thunderstrike',
    'Darkwind',
    'Lightseeker',
    'Steelclaw',
] as const;

export const RANDOM_PROBABILITY = 0.5;