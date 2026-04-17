import {
    findSanctuaryTopLeft,
    getSanctuaryCanonicalInfo,
    getSanctuaryTargets,
} from '@app/services/game-view/game-sanctuary.utils';
import { TileItem, TileTexture } from '@common/enums';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

// Factories

const floor = (): Tile => ({ type: TileTexture.Floor, item: null });
const sanctuary = (item: TileItem.HealingSanctuary | TileItem.CombatSanctuary): Tile => ({
    type: TileTexture.Floor,
    item,
});

const SOCKET_A = 'socket-a';

const buildGridWithSanctuary = (): Tile[][] => [
    [floor(), floor(), floor(), floor()],
    [floor(), sanctuary(TileItem.HealingSanctuary), sanctuary(TileItem.HealingSanctuary), floor()],
    [floor(), sanctuary(TileItem.HealingSanctuary), sanctuary(TileItem.HealingSanctuary), floor()],
    [floor(), floor(), floor(), floor()],
];

describe('game-sanctuary.utils', () => {

    describe('findSanctuaryTopLeft', () => {
        const grid = buildGridWithSanctuary();

        /** Returns the top-left corner of the block when starting from the bottom-right sanctuary tile. */
        it('should find top-left from the bottom-right tile of the block', () => {
            const result = findSanctuaryTopLeft(grid, 2, 2, TileItem.HealingSanctuary);
            expect(result).toEqual({ x: 1, y: 1 });
        });

        /** Returns the correct corner from the top-left tile itself, confirming idempotency. */
        it('should return the same position when already at the top-left', () => {
            const result = findSanctuaryTopLeft(grid, 1, 1, TileItem.HealingSanctuary);
            expect(result).toEqual({ x: 1, y: 1 });
        });

        /** Returns the correct corner from any of the four tiles within the block. */
        it('should find top-left from the top-right tile of the block', () => {
            const result = findSanctuaryTopLeft(grid, 2, 1, TileItem.HealingSanctuary);
            expect(result).toEqual({ x: 1, y: 1 });
        });
    });

    describe('getSanctuaryCanonicalInfo', () => {
        const grid = buildGridWithSanctuary();

        /** Returns canonicalPos as the block's top-left corner and marks adjacency true when the player is directly beside it. */
        it('should mark isAdjacent true when player is directly next to the sanctuary', () => {
            const result = getSanctuaryCanonicalInfo({ x: 1, y: 1 }, {
                item: TileItem.HealingSanctuary,
                grid,
                currentSocketId: SOCKET_A,
                positions: { [SOCKET_A]: { x: 0, y: 1 } },
            });
            expect(result.canonicalPos).toEqual({ x: 1, y: 1 });
            expect(result.isAdjacent).toBe(true);
        });

        /** Returns isAdjacent false when the player is far from the sanctuary block. */
        it('should mark isAdjacent false when player is far from sanctuary', () => {
            const FAR = 3;
            const result = getSanctuaryCanonicalInfo({ x: 1, y: 1 }, {
                item: TileItem.HealingSanctuary,
                grid,
                currentSocketId: SOCKET_A,
                positions: { [SOCKET_A]: { x: FAR, y: FAR } },
            });
            expect(result.isAdjacent).toBe(false);
        });

        /** Returns isAdjacent false when no position is available for the current player. */
        it('should return isAdjacent false when player has no recorded position', () => {
            const result = getSanctuaryCanonicalInfo({ x: 1, y: 1 }, {
                item: TileItem.HealingSanctuary,
                grid,
                currentSocketId: SOCKET_A,
                positions: {},
            });
            expect(result.isAdjacent).toBe(false);
        });

        /** Returns isAdjacent false when currentSocketId is undefined. */
        it('should return isAdjacent false when currentSocketId is undefined', () => {
            const result = getSanctuaryCanonicalInfo({ x: 1, y: 1 }, {
                item: TileItem.HealingSanctuary,
                grid,
                currentSocketId: undefined,
                positions: {},
            });
            expect(result.isAdjacent).toBe(false);
        });
    });

    describe('getSanctuaryTargets', () => {
        const BLOCK_TILES = 4;
        const grid = buildGridWithSanctuary();

        /** Returns the four tiles of the adjacent sanctuary block when the player is next to one active sanctuary. */
        it('should return the 4-tile block for an adjacent active sanctuary', () => {
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 0, y: 1 } };
            const result = getSanctuaryTargets(SOCKET_A, positions, grid, []);
            expect(result.length).toBe(BLOCK_TILES);
        });

        /** Returns an empty array when the local player has no recorded position. */
        it('should return empty when player has no position', () => {
            const result = getSanctuaryTargets(SOCKET_A, {}, grid, []);
            expect(result).toEqual([]);
        });

        /** Returns an empty array when localId is undefined. */
        it('should return empty when localId is undefined', () => {
            const result = getSanctuaryTargets(undefined, { [SOCKET_A]: { x: 0, y: 1 } }, grid, []);
            expect(result).toEqual([]);
        });

        /** Excludes a sanctuary when all its tiles are listed in the inactive sanctuaries array. */
        it('should exclude inactive sanctuaries', () => {
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 0, y: 1 } };
            const inactive: Vec2[] = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }];
            const result = getSanctuaryTargets(SOCKET_A, positions, grid, inactive);
            expect(result.length).toBe(0);
        });

        /** Does not double-count the same sanctuary block when multiple adjacent tiles belong to it. */
        it('should not duplicate the block when player is adjacent to multiple tiles of the same sanctuary', () => {
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 0, y: 2 } };
            const result = getSanctuaryTargets(SOCKET_A, positions, grid, []);
            expect(result.length).toBe(BLOCK_TILES);
        });
    });
});
