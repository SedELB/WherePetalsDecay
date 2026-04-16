import { JournalService } from '@app/services/journal/journal.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GameLogicService } from './game-logic.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';
import { VirtualPlayerService } from './virtual-player.service';

describe('VirtualPlayerService', () => {
    let service: VirtualPlayerService;

    const mockPathfindingService: Partial<VirtualPlayerPathfindingService> = {
        computeFullDijkstra: jest.fn(),
        reconstructPath: jest.fn(),
        findFurthestReachablePositionOnPath: jest.fn(),
        getReachableTilesWithinBudget: jest.fn(),
        isTileOccupiedByAnotherPlayer: jest.fn().mockReturnValue(false),
        positionKey: jest.fn((pos) => `${pos.x},${pos.y}`),
    };

    const mockGameLogicService: Partial<GameLogicService> = {
        endTurn: jest.fn(),
        checkWinCondition: jest.fn().mockReturnValue(null),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VirtualPlayerService,
                { provide: VirtualPlayerPathfindingService, useValue: mockPathfindingService },
                { provide: GameLogicService, useValue: mockGameLogicService },
                { provide: VirtualPlayerScannerService, useValue: {} },
                { provide: JournalService, useValue: { addSanctuaryUsedEntry: jest.fn() } },
            ],
        }).compile();

        service = module.get<VirtualPlayerService>(VirtualPlayerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
