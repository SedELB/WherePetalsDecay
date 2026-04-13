import { Test, TestingModule } from '@nestjs/testing';
import { CombatService } from './combat.service';
import { CTFService } from './ctf.service';
import { GameLogicService } from './game-logic.service';
import { GameSetupService } from './game-setup.service';
import { MovementService } from './movement.service';
import { SanctuaryService } from './sanctuary.service';
import { TurnService } from './turn.service';

describe('GameLogicService', () => {
  let service: GameLogicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameLogicService,
        { provide: TurnService, useValue: {} },
        { provide: MovementService, useValue: {} },
        { provide: CombatService, useValue: {} },
        { provide: CTFService, useValue: {} },
        { provide: SanctuaryService, useValue: {} },
        {
          provide: GameSetupService,
          useValue: {
            buildGameStats: jest.fn(),
            extractSpawnPositions: jest.fn(),
            shuffle: jest.fn(),
            removeUnusedSpawns: jest.fn(),
            computeTurnOrder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GameLogicService>(GameLogicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
