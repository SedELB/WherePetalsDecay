import { TileItem, TileTexture } from './enums';

export type SanctuaryType = TileItem.HealingSanctuary | TileItem.CombatSanctuary;

export interface Tile {
    type: TileTexture;
    item: TileItem | null;
}