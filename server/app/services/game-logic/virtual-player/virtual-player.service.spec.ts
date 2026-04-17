import { Test, TestingModule } from '@nestjs/testing';
import { VirtualPlayerProfile } from '@common/enums';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { VirtualPlayerService } from './virtual-player.service';
import { VPActionService } from './vp-action.service';
import { VPClassicStrategyService } from './vp-classic-strategy.service';
import { VPCtfStrategyService } from './vp-ctf-strategy.service';

describe('VirtualPlayerService', () => {
    let service: VirtualPlayerService;
    let mockActionService: { postureForProfile: jest.Mock; getRandomTurnStartDelay: jest.Mock };
    let mockGameLogicService: { endTurn: jest.Mock; checkWinCondition: jest.Mock; getActiveGame: jest.Mock };

    beforeEach(async () => {
        mockActionService = {
            postureForProfile: jest.fn((profile: VirtualPlayerProfile) =>
                profile === VirtualPlayerProfile.Aggressive
                    ? { type: 'atk', bonus: 2 }
                    : { type: 'def', bonus: 2 },
            ),
            getRandomTurnStartDelay: jest.fn().mockReturnValue(0),
        };

        mockGameLogicService = {
            endTurn: jest.fn(),
            checkWinCondition: jest.fn().mockReturnValue(null),
            getActiveGame: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VirtualPlayerService,
                { provide: VPActionService, useValue: mockActionService },
                { provide: VPClassicStrategyService, useValue: {} },
                { provide: VPCtfStrategyService, useValue: {} },
                { provide: GameLogicService, useValue: mockGameLogicService },
            ],
        }).compile();

        service = module.get<VirtualPlayerService>(VirtualPlayerService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('getPosture should always use profile posture for aggressive bot', () => {
        const player = {
            socketId: 'vp-1',
            virtualProfile: VirtualPlayerProfile.Aggressive,
            character: { bonusPosture: null },
        };
        mockGameLogicService.getActiveGame.mockReturnValue({ lobby: { players: [player] } });

        const posture = service.getPosture('lobby-1', 'vp-1');

        expect(mockActionService.postureForProfile).toHaveBeenCalledWith(VirtualPlayerProfile.Aggressive);
        expect(posture).toEqual({ type: 'atk', bonus: 2 });
        expect(player.character.bonusPosture).toEqual({ type: 'atk', bonus: 2 });
    });

    it('getPosture should fallback to current posture when player has no profile', () => {
        const existingPosture = { type: 'def', bonus: 2 };
        const player = { socketId: 'real-1', character: { bonusPosture: existingPosture } };
        mockGameLogicService.getActiveGame.mockReturnValue({ lobby: { players: [player] } });

        const posture = service.getPosture('lobby-1', 'real-1');

        expect(mockActionService.postureForProfile).not.toHaveBeenCalled();
        expect(posture).toBe(existingPosture);
    });
});
