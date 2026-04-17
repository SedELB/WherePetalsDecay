export interface RandomCharacter {
    name: string;
    avatarPath: string;
    lifeBonus: boolean;
    attackDiceD6: boolean;
}

export interface MapSizeConfig {
    rows: number;
    cols: number;
    maxPlayers: number;
}

export type SortColumn =
    | 'name'
    | 'combatCount'
    | 'winsCount'
    | 'lossCount'
    | 'totalHpLost'
    | 'totalHpDealt'
    | 'visitedTilesPercent';
