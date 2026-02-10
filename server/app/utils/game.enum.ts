export enum GameMode {
    Classic = 'classic',
    Ctf = 'ctf'
}

export enum TileTexture {
    Floor = 'floor',
    Wall = 'wall',
    Water = 'water',
    Ice = 'ice',
    DoorOpened = 'doorOpened',
    DoorClosed = 'doorClosed',
}

export enum TileItem {
    Spawn = 'spawn',
    Flag = 'flag',
    HealingSanctuary = 'healingSanctuary',
    CombatSanctuary = 'combatSanctuary',
}

export enum GridSizes {
    Small = 10,
    Medium = 15,
    Large = 20,
};

export enum NbPlayersSmall {
    MinPlayers = 2,
    MaxPLayers = 2,
}

export enum NbPlayersMedium {
    MinPlayers = 2,
    MaxPLayers = 4,
}

export enum NbPlayersLarge {
    MinPlayers = 2,
    MaxPLayers = 6,
}