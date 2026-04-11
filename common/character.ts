export type Posture = { type: 'atk' | 'def' | null, bonus: 2 | 0}
export type Debuf = 2 | 0;

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
    bonusPosture?: Posture;
    debuf?: Debuf;
}

