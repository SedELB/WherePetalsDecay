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

