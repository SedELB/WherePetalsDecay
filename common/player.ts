export interface Player {
    id: string;           // socket.id
    name: string;
    avatar: string;
    isOrganizer: boolean;
    life: number;
    speed: number;
    attack: number;
    defense: number;
    attackDice: 'D4' | 'D6';
    defenseDice: 'D4' | 'D6';
}
