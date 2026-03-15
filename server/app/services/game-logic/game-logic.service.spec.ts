import { Test, TestingModule } from '@nestjs/testing';
import { GameLogicService } from './game-logic.service';
import { TurnService } from './turn.service';
import { MovementService } from './movement.service';
import { CombatService } from './combat.service';

describe('GameLogicService', () => {
  let service: GameLogicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameLogicService, TurnService, MovementService, CombatService],
    }).compile();

    service = module.get<GameLogicService>(GameLogicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
