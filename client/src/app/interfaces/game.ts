import { Vec2 } from './vec2';

export type GameMode = 'classic' | 'ctf';

export type GameObjectType = 'spawn' | 'flag' | 'healingShrine' | 'combatShrine';

export interface PlacedObject {
    type: GameObjectType;
    position: Vec2;
    size?: { w: number; h: number };
}

export interface Game {
    _id?: string;
    name: string;
    description: string;
    mode: GameMode;
    size: { rows: number; cols: number };
    grid: string;
    objects: string;
    lastModifiedIso: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface GameCard {
    id: number;
    image: string;
    name: string;
    size: { rows: number; cols: number };
    mode: string;
    date: string;
    visible: boolean;
    imgDescription: string;
}
