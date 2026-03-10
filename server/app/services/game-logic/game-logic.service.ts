import { Player } from '@common/player';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameLogicService {
    // Temporary method to shuffle players in a lobby made by AI
    // TODO: to change later
    shufflePlayers(players: Player[]): Player[] {
        const shuffled = [...players];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}
