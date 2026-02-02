import { TileTexture, TileItem } from '@common/enums';

export interface Tile {
    type: TileTexture;
    item?: TileItem;
}