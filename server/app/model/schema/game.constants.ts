export enum GameMode {
    CLASSIC = 'classic',
    CTF = 'ctf'
}

export enum TileType {
    FLOOR = 'floor',
    WALL = 'wall',
    WATER = 'water',
    ICE = 'ice',
    DOOR = 'door'
}

export enum DoorState {
    OPEN = 'open',
    CLOSED = 'closed'
}

export enum TileItem {
    START = 'start',
    FLAG = 'flag',
    HEALING_SANCTUARY = 'healingSanctuary',
    COMBAT_SANCTUARY = 'combatSanctuary',
}

export const GRID_SIZES = {
    SMALL: 10,
    MEDIUM: 15,
    LARGE: 20,
};