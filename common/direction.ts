import { Vec2 } from './vec2';

export type Direction = 'W' | 'A' | 'S' | 'D';

export const DIRECTION_OFFSETS: Record<Direction, Vec2> = {
    W: { x: 0, y: -1 },
    A: { x: -1, y: 0 },
    S: { x: 0, y: 1 },
    D: { x: 1, y: 0 },
};

export const KEY_TO_DIRECTION: Record<string, Direction> = {
    w: 'W', a: 'A', s: 'S', d: 'D',
    W: 'W', A: 'A', S: 'S', D: 'D',
};
