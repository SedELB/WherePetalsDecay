export const BASE_STATS = {
    life: 6,
    speed: 6,
    attack: 4,
    defense: 4,
    bonus: 2,
};

import { ASSET_PATHS } from './asset-paths.constants';

const BASE_AVATAR_PATH = ASSET_PATHS.avatars.basePath;

export const AVATARS_PATH: readonly string[] = [
    `${BASE_AVATAR_PATH}/archer.webp`,
    `${BASE_AVATAR_PATH}/assassin.webp`,
    `${BASE_AVATAR_PATH}/axe_warrior.webp`,
    `${BASE_AVATAR_PATH}/centaur.webp`,
    `${BASE_AVATAR_PATH}/dark_elf.webp`,
    `${BASE_AVATAR_PATH}/druid.webp`,
    `${BASE_AVATAR_PATH}/elf.webp`,
    `${BASE_AVATAR_PATH}/farmer.webp`,
    `${BASE_AVATAR_PATH}/mage.webp`,
    `${BASE_AVATAR_PATH}/magic_lancer.webp`,
    `${BASE_AVATAR_PATH}/marksman.webp`,
    `${BASE_AVATAR_PATH}/unknown_being.webp`,
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
