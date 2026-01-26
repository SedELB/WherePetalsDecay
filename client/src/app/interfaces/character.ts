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

export const AVATARS: string[] = [
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
    'assets/filler.png',
];

export const RANDOM_NAMES: string[] = [
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
];