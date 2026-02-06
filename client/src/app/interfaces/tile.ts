import { Vec2 } from './vec2';

export type TileType = 'floor' | 'wall' | 'water' | 'ice' | 'doorOpen' | 'doorClosed';

export interface Tile {
    position: Vec2;
    type: TileType;

    isClicked?: boolean;
}