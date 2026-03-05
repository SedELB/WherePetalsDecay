import { TileItem, TileTexture } from './enums';

export interface Tile {
    type: TileTexture;
    item: TileItem | null;
}