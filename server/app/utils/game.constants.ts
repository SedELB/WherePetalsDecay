import { DESC_MAX_LENGTH, NAME_MAX_LENGTH, TEXT_MIN_LENGTH } from '@common/constants/validation.constants';
import { TileItem, TileTexture } from '@common/enums';

export { DESC_MAX_LENGTH, NAME_MAX_LENGTH, TEXT_MIN_LENGTH };
export const MIN_PLAYERS_DTO = 2;
export const MAX_PLAYERS_DTO = 6;
export const BASE_10 = 10;
export const BASE_15 = 15;
const BASE_4 = 4;
const BASE_9 = 9;

// Custom Grids made in a Excel file to be able to count properties.
export const CUSTOM_GRID_CLASSIC_SMALL = [
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: TileItem.Spawn }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.DoorClosed, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null },
    ],
    ...Array(BASE_4).fill(Array(BASE_10).fill({ type: TileTexture.Floor, item: null })),
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: TileItem.HealingSanctuary },
        { type: TileTexture.Floor, item: TileItem.CombatSanctuary }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: TileItem.Spawn },
        { type: TileTexture.Floor, item: null },
    ],
];

export const CUSTOM_GRID_CTF_SMALL = [
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: TileItem.Spawn }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: TileItem.Flag },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.DoorClosed, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null },
    ],
    ...Array(BASE_4).fill(Array(BASE_10).fill({ type: TileTexture.Floor, item: null })),
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: TileItem.Spawn },
        { type: TileTexture.Floor, item: null },
    ],
];

export const CUSTOM_GRID_CLASSIC_MEDIUM = [
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: TileItem.Spawn },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: TileItem.Spawn },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Water, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Water, item: null }, { type: TileTexture.Water, item: null }, { type: TileTexture.Water, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.DoorClosed, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Water, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null },
    ],
    [
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null }, { type: TileTexture.Ice, item: null },
    ],
    ...Array(BASE_9).fill(Array(BASE_15).fill({ type: TileTexture.Floor, item: null })),
    [
        { type: TileTexture.Floor, item: TileItem.Spawn }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null }, { type: TileTexture.Ice, item: null },
    ],
    [
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.DoorClosed, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null }, { type: TileTexture.Ice, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Floor, item: TileItem.Spawn },
        { type: TileTexture.Floor, item: null }, { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null },
        { type: TileTexture.Ice, item: null }, { type: TileTexture.Water, item: null }, { type: TileTexture.Ice, item: null },
    ],
];

export const CUSTOM_GRID_CLASSIC_SMALL_INVALID = [
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: TileItem.Spawn }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null },
    ],
    ...Array(BASE_4).fill(Array(BASE_10).fill({ type: TileTexture.Wall, item: null })),
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null },
    ],
    [
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null }, { type: TileTexture.Wall, item: null },
        { type: TileTexture.Wall, item: null },
    ],
];