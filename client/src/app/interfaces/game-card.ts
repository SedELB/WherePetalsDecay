import { GameMode } from '@common/enums';
import { GridSize } from '@common/interfaces/grid-size';

export interface GameCard {
    name: string;
    description: string;
    size: GridSize;
    gameMode: GameMode;
    thumbnail: string;
    createdAt: Date;
    updatedAt: Date;
    isVisible: boolean;
}
