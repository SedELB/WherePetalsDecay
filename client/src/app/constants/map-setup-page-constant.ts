import { ASSET_PATHS } from '@common/constants/asset-paths.constants';
import { TileItem, TileTexture } from '@common/enums';

interface ObjectPlacementTool {
    type: TileItem;
    label: string;
    description: string;
    image: string;
}

interface TileTool {
    type: TileTexture;
    label: string;
    description: string;
    image: string;
}

export enum MouseEventType {
    LeftClick = 0,
    RightClick = 2,
    LeftDrag = 1,
    RightDrag = 2,
}

export const THUMBNAIL_QUALITY = 0.85;
export const THUMBNAIL_MAX_SIZE = 256;

export const OBJECT_PLACEMENT_TOOL: Record<TileItem, ObjectPlacementTool> = {
    [TileItem.Spawn]: {
        type: TileItem.Spawn,
        label: 'Point de départ',
        description: 'Emplacement où un joueur apparaît au début de la partie.',
        image: './assets/icons/spawnPoint.svg',
    },
    [TileItem.Flag]: {
        type: TileItem.Flag,
        label: 'Drapeau',
        description: 'Le drapeau à capturer',
        image: './assets/icons/blackflag.svg',
    },
    [TileItem.HealingSanctuary]: {
        type: TileItem.HealingSanctuary,
        label: 'Relique de soin',
        description: 'Emplacement où un joueur peut placer une relic de soin.',
        image: './assets/icons/healingSanctuary.svg',
    },
    [TileItem.CombatSanctuary]: {
        type: TileItem.CombatSanctuary,
        label: 'Relique de combat',
        description: 'Emplacement où un joueur peut placer une relic de combat.',
        image: './assets/icons/combatSanctuary.svg',
    },
};

export const TILE_TOOLS: Record<TileTexture, TileTool> = {
    [TileTexture.Floor]: {
        type: TileTexture.Floor,
        label: 'Sol',
        description: 'Surface de base, permet le passage libre des joueurs.',
        image: ASSET_PATHS.tiles.floor,
    },
    [TileTexture.Wall]: {
        type: TileTexture.Wall,
        label: 'Mur',
        description: 'Bloque le passage des joueurs.',
        image: ASSET_PATHS.tiles.wall,
    },
    [TileTexture.Water]: {
        type: TileTexture.Water,
        label: 'Eau',
        description: 'Zone liquide, ralentit ou bloque selon les règles.',
        image: ASSET_PATHS.tiles.water,
    },
    [TileTexture.Ice]: {
        type: TileTexture.Ice,
        label: 'Glace',
        description: 'Surface glissante qui modifie les déplacements.',
        image: ASSET_PATHS.tiles.ice,
    },
    [TileTexture.DoorOpened]: {
        type: TileTexture.DoorOpened,
        label: 'Porte ouverte',
        description: 'Porte ouverte qui permet le passage des joueurs.',
        image: ASSET_PATHS.tiles.doorOpened,
    },
    [TileTexture.DoorClosed]: {
        type: TileTexture.DoorClosed,
        label: 'Porte',
        description: 'Porte fermée qui bloque le passage des joueurs.',
        image: ASSET_PATHS.tiles.doorClosed,
    },
};
