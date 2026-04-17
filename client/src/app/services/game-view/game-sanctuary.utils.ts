import { SANCTUARY_BLOCK_SIZE } from '@app/services/game-view/game-view.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { TileItem } from '@common/enums';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

export const findSanctuaryTopLeft = (grid: Tile[][], x: number, y: number, item: TileItem): Vec2 => {
    let tlX = x;
    let tlY = y;
    while (grid[tlY - 1]?.[tlX]?.item === item) tlY--;
    while (grid[tlY]?.[tlX - 1]?.item === item) tlX--;
    return { x: tlX, y: tlY };
};

export const getSanctuaryCanonicalInfo = (
    pos: Vec2,
    context: { item: TileItem; grid: Tile[][]; currentSocketId: string | undefined; positions: Record<string, Vec2> },
): { canonicalPos: Vec2; isAdjacent: boolean } => {
    const { item, grid, currentSocketId, positions } = context;
    const tl = findSanctuaryTopLeft(grid, pos.x, pos.y, item);
    const myPos = currentSocketId ? positions[currentSocketId] : null;

    if (!myPos) return { canonicalPos: tl, isAdjacent: false };

    const isAdjacent = [{ x: tl.x, y: tl.y }, { x: tl.x + 1, y: tl.y }, { x: tl.x, y: tl.y + 1 }, { x: tl.x + 1, y: tl.y + 1 }].some((c) =>
        Object.values(DIRECTION_OFFSETS).some((o) => myPos.x + o.x === c.x && myPos.y + o.y === c.y),
    );

    return { canonicalPos: tl, isAdjacent };
};

const addSanctuaryBlock = (results: Vec2[], tl: Vec2): void => {
    for (let dy = 0; dy < SANCTUARY_BLOCK_SIZE; dy++) {
        for (let dx = 0; dx < SANCTUARY_BLOCK_SIZE; dx++) {
            results.push({ x: tl.x + dx, y: tl.y + dy });
        }
    }
};

export const getSanctuaryTargets = (
    localId: string | undefined,
    positions: Record<string, Vec2>,
    grid: Tile[][],
    inactiveSanctuaries: Vec2[],
): Vec2[] => {
    if (!localId || !positions[localId]) return [];
    const myPos = positions[localId];
    const results: Vec2[] = [];
    const visitedTopLeft = new Set<string>();
    const adjacent = Object.values(DIRECTION_OFFSETS).map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }));

    for (const pos of adjacent) {
        const tile = grid[pos.y]?.[pos.x];
        if (!tile?.item) continue;

        const isSanctuary = tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary;
        const isInactive = inactiveSanctuaries.some((s) => s.x === pos.x && s.y === pos.y);

        if (isSanctuary && !isInactive) {
            const tl = findSanctuaryTopLeft(grid, pos.x, pos.y, tile.item as TileItem);
            const key = `${tl.x},${tl.y}`;
            if (!visitedTopLeft.has(key)) {
                visitedTopLeft.add(key);
                addSanctuaryBlock(results, tl);
            }
        }
    }
    return results;
};
