import { DiceType, PostureType } from './enums';

export type Posture = { type: PostureType | null, bonus: 2 | 0}
export type Debuf = 2 | 0;

export interface Character {
    name: string;
    avatar: string;
    life: number;
    speed: number;
    attack: number;
    defense: number;
    lifeBonus: boolean;
    attackDice: DiceType;
    defenseDice: DiceType;
    bonusPosture?: Posture;
    debuf?: Debuf;
}

