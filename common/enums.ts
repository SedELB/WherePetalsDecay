export enum GameMode {
    Classic = 'classic',
    Ctf = 'ctf',
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
}

export enum MaxPlayers {
    Small = 2,
    Medium = 4,
    Large = 6,
}

export enum SanctuaryCount {
    Small = 1,
    Medium = 2,
    Large = 4,
}

export enum SocketNamespace {
    Admin = '/admin',
    Games = '/game',
    Join = '/join',
    Combat = '/combat',
}

export enum ButtonVariant {
    Default = 'default',
    Back = 'back',
    Save = 'save',
    DeleteGame = 'delete-game',
    Edit = 'edit',
    ToggleVisibility = 'toggle-visibility',
    AddVirtualPlayer = 'add-virtual-player',
    Menu = 'menu',
}

export enum MapSetupMode {
    Create = 'create',
    Edit = 'edit',
}

export enum MapSizeKey {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

export enum PlayerType {
    Reel = 'real',
    Virtual = 'virtual',
}

export enum VirtualPlayerProfile {
    Aggressive = 'aggressive',
    Defensive = 'defensive',
}

export enum TurnPhase {
    BetweenTurn = 'between-turn',
    ActiveTurn = 'active-turn',
}

export enum PlayerAction {
    Attack = 'attack',
    ToggleDoor = 'toggleDoor',
    RequestFlag = 'requestFlag',
    GiveFlag = 'giveFlag',
    Sanctuary = 'sanctuary',
}

export enum SanctuaryMode {
    Normal = 'normal',
    DoubleOrNothing = 'doubleOrNothing',
}

export enum DiceType {
    D4 = 'D4',
    D6 = 'D6',
}

export enum DiceRollMode {
    Random = 'random',
    Max = 'max',
    Min = 'min',
}

export enum PostureType {
    Attack = 'atk',
    Defense = 'def',
}
