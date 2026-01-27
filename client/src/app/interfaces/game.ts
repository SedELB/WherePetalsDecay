import { Tile } from './tile';
import { Vec2 } from './vec2';

export type GameMode = 'classic' | 'ctf';

export type GameObjectType = 'spawn' | 'flag' | 'healingShrine' | 'combatShrine';

export interface PlacedObject {
    type: GameObjectType;
    /**
     * Position en coordonnées de grille (x=col, y=row).
     * Pour un sanctuaire 2x2, c'est le coin supérieur gauche.
     */
    position: Vec2;
    /**
     * Taille (par défaut 1x1).
     * Les sanctuaires pourront être 2x2 au sprint 3.
     */
    size?: { w: number; h: number };
}

/**
 * Objet complet à envoyer au backend lors d'un "save".
 * (Ici on le crée seulement côté client.)
 */
export interface Game {
    id?: string;
    name: string;
    description: string;
    mode: GameMode;
    size: { rows: number; cols: number };
    grid: Tile[][];
    objects?: PlacedObject[];
    lastModifiedIso?: string;
}

