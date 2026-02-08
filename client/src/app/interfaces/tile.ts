import { TileItem, TileTexture } from '@common/enums';

export interface Tile {
    type: TileTexture;
    item: TileItem | null;
}
