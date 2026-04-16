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
  let combatServiceMock: { initiateCombat: jest.Mock };

  beforeEach(async () => {
    combatServiceMock = {
      initiateCombat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameLogicService,
        { provide: TurnService, useValue: {} },
        { provide: MovementService, useValue: {} },
        { provide: CombatService, useValue: combatServiceMock },
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

  it('should apply debug dice strategy dynamically when debug mode is toggled', () => {
    const firstCallIndex = 1;
    const secondCallIndex = 2;
    const thirdCallIndex = 3;
    const lobbyId = 'lobby-1';
    const attackerId = 'attacker';
    const defenderId = 'defender';

    const attacker = { socketId: attackerId, hasFlag: false };
    const defender = { socketId: defenderId, hasFlag: false };

    const activeGame = {
      isDebugMode: false,
      lobby: {
        players: [attacker, defender],
      },
    };

    (service as unknown as { activeGames: Map<string, unknown> }).activeGames.set(lobbyId, activeGame);

    combatServiceMock.initiateCombat.mockReturnValue({
      attacker: {
        killed: false,
      },
      defender: {
        killed: false,
      },
    });

    service.initiateCombat(lobbyId, attackerId, defenderId, true);

    activeGame.isDebugMode = true;
    service.initiateCombat(lobbyId, attackerId, defenderId, true);

    activeGame.isDebugMode = false;
    service.initiateCombat(lobbyId, attackerId, defenderId, true);

    expect(combatServiceMock.initiateCombat).toHaveBeenNthCalledWith(
      firstCallIndex,
      activeGame,
      attackerId,
      defenderId,
      true,
      undefined,
    );

    expect(combatServiceMock.initiateCombat).toHaveBeenNthCalledWith(
      secondCallIndex,
      activeGame,
      attackerId,
      defenderId,
      true,
      { attacker: 'max', defender: 'min' },
    );

    expect(combatServiceMock.initiateCombat).toHaveBeenNthCalledWith(
      thirdCallIndex,
      activeGame,
      attackerId,
      defenderId,
      true,
      undefined,
    );
  });
});
