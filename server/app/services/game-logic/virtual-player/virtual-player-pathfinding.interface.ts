import { Vec2 } from '@common/vec2';
import { SanctuaryType } from '@common/tile';

export interface DijkstraNode {
    position: Vec2;
    cumulativeCost: number;
}

export interface DijkstraResult {
    costToPosition: Map<string, number>;
    predecessorKey: Map<string, string | null>;
}

export interface SanctuarySearchOptions {
    sanctuaryType: SanctuaryType;
    reachableThisTurn?: boolean;
    precomputedCostToPosition?: Map<string, number>;
}
