import { GameSessionService } from '@app/services/game-session/game-session.service';
import { Test, TestingModule } from '@nestjs/testing';

describe('GameSessionService', () => {
    let gameSessionService: GameSessionService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GameSessionService],
        }).compile();

        gameSessionService = module.get<GameSessionService>(GameSessionService);
    });

    it('should be defined', () => {
        expect(gameSessionService).toBeDefined();
    });
});
