import { GameMode } from '@common/enums';

export interface GameCard {
    name: string;
    description: string;
    size: { rows: number; cols: number };
    gameMode: GameMode;
    thumbnail: string;
    createdAt: Date;
    updatedAt: Date;
    isVisible: boolean;
}
