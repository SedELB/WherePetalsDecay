import { Vec2 } from './vec2';

export type GameMode = 'classic' | 'ctf';

export type GameObjectType = 'spawn' | 'flag' | 'healingShrine' | 'combatShrine';

export interface PlacedObject {
    type: GameObjectType;
    position: Vec2;
    size?: { w: number; h: number };
}



/**
 * Format compatible backend (sérialisé pour la transmission)
 */
export interface Game {
    _id?: string;
    name: string;
    description: string;
    mode: GameMode;
    size: { rows: number; cols: number };
    grid: string; // JSON stringified
    objects: string; // JSON stringified
    lastModifiedIso: string;
    createdAt?: string;
    updatedAt?: string;
}

