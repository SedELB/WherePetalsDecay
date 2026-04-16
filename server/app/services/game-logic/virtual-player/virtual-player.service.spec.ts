import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { Test, TestingModule } from '@nestjs/testing';
import { VirtualPlayerActionService } from './virtual-player-action.service';
import { VirtualPlayerCtfService } from './virtual-player-ctf.service';
import { VirtualPlayerMovementService } from './virtual-player-movement.service';
import { VirtualPlayerProfileService } from './virtual-player-profile.service';
import { VirtualPlayerService } from './virtual-player.service';

describe('VirtualPlayerService', () => {
    let service: VirtualPlayerService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VirtualPlayerService,
                { provide: GameLogicService, useValue: { endTurn: jest.fn(), checkWinCondition: jest.fn().mockReturnValue(null) } },
                { provide: VirtualPlayerMovementService, useValue: {} },
                { provide: VirtualPlayerProfileService, useValue: {} },
                { provide: VirtualPlayerCtfService, useValue: {} },
                { provide: VirtualPlayerActionService, useValue: { combat: {}, sanctuary: {} } },
            ],
        }).compile();

        service = module.get<VirtualPlayerService>(VirtualPlayerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
