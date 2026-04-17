import { DESC_MAX_LENGTH, NAME_MAX_LENGTH, TEXT_MIN_LENGTH } from '@common/constants/validation.constants';
import { TileItem, TileTexture } from '@common/enums';

export { DESC_MAX_LENGTH, NAME_MAX_LENGTH, TEXT_MIN_LENGTH };
export const MIN_PLAYERS_DTO = 2;
export const MAX_PLAYERS_DTO = 6;
export const SMALL_MAP_COLS = 10;
export const MED_MAP_COLS = 15;
const SMALL_MAP_WALL_ROWS = 4;
const MED_MAP_WALL_ROWS = 9;

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
    ...Array(SMALL_MAP_WALL_ROWS).fill(Array(SMALL_MAP_COLS).fill({ type: TileTexture.Floor, item: null })),
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

export const CUSTOM_GRID_CTF_SMALL = CUSTOM_GRID_CLASSIC_SMALL.map((row) => row.map((tile) => ({ ...tile })));
CUSTOM_GRID_CTF_SMALL[1][1] = { type: TileTexture.Floor, item: TileItem.Flag };

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
    ...Array(MED_MAP_WALL_ROWS).fill(Array(MED_MAP_COLS).fill({ type: TileTexture.Floor, item: null })),
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
    ...Array(SMALL_MAP_WALL_ROWS).fill(Array(SMALL_MAP_COLS).fill({ type: TileTexture.Wall, item: null })),
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