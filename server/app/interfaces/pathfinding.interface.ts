import { Vec2 } from '@common/vec2';

export interface DijkstraNode {
    position: Vec2;
    cumulativeCost: number;
}

export interface DijkstraResult {
    costToPosition: Map<string, number>;
    predecessorKey: Map<string, string | null>;
}
