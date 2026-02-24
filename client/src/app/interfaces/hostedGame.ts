import { GameMode } from '@common/enums';


export interface HostedGame {
    name: string;
    description: string;
    size: { rows: number, cols: number };
    gameMode: GameMode;
    thumbnail: string;
    updatedAt: Date;
    isVisible: boolean;
    playerJoined: number;
}