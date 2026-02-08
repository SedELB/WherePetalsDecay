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
    `${BASE_AVATAR_PATH}/archer.png`,
    `${BASE_AVATAR_PATH}/assassin.png`,
    `${BASE_AVATAR_PATH}/axe_warrior.png`,
    `${BASE_AVATAR_PATH}/centaur.png`,
    `${BASE_AVATAR_PATH}/dark_elf.png`,
    `${BASE_AVATAR_PATH}/druid.png`,
    `${BASE_AVATAR_PATH}/elf.png`,
    `${BASE_AVATAR_PATH}/farmer.png`,
    `${BASE_AVATAR_PATH}/mage.png`,
    `${BASE_AVATAR_PATH}/magic_lancer.png`,
    `${BASE_AVATAR_PATH}/marksman.png`,
    `${BASE_AVATAR_PATH}/unknown_being.png`,
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