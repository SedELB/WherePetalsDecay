import { TileTexture } from './enums';

export const TILE_COSTS: Record<TileTexture, number> = {
    [TileTexture.Floor]: 1,
    [TileTexture.Water]: 2,
    [TileTexture.Ice]: 0,
    [TileTexture.Wall]: Infinity,
    [TileTexture.DoorOpened]: 1,
    [TileTexture.DoorClosed]: Infinity,
};
