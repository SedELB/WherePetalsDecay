
export interface GameCard {
    name: string;
    description: string;
    size: { rows: number, cols: number };
    gameMode: string;
    thumbnail: string;
    updatedAt: Date;
    isVisible: boolean;
}
