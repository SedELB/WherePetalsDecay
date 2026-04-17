import { Test, TestingModule } from '@nestjs/testing';
import { AbandonService } from './abandon.service';
import { CTFService } from './ctf.service';
import { GameActionService } from './game-action.service';
import { GameLogicService } from './game-logic.service';
import { GameManagerService } from './game-manager.service';

describe('GameLogicService', () => {
  let service: GameLogicService;
  let actionServiceMock: { initiateCombat: jest.Mock };

  beforeEach(async () => {
    actionServiceMock = {
      initiateCombat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameLogicService,
        { provide: GameManagerService, useValue: {} },
        { provide: GameActionService, useValue: actionServiceMock },
        { provide: CTFService, useValue: {} },
        { provide: AbandonService, useValue: {} },
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

    actionServiceMock.initiateCombat.mockReturnValue({
      attacker: {
        killed: false,
      },
      defender: {
        killed: false,
      },
    });

    service.initiateCombat({ lobbyId, attackerId, defenderId, consumeActionPoint: true });

    activeGame.isDebugMode = true;
    service.initiateCombat({ lobbyId, attackerId, defenderId, consumeActionPoint: true });

    activeGame.isDebugMode = false;
    service.initiateCombat({ lobbyId, attackerId, defenderId, consumeActionPoint: true });

    expect(actionServiceMock.initiateCombat).toHaveBeenNthCalledWith(
      firstCallIndex,
      activeGame,
      attackerId,
      defenderId,
      true,
      undefined,
    );

    expect(actionServiceMock.initiateCombat).toHaveBeenNthCalledWith(
      secondCallIndex,
      activeGame,
      attackerId,
      defenderId,
      true,
      { attacker: 'max', defender: 'min' },
    );

    expect(actionServiceMock.initiateCombat).toHaveBeenNthCalledWith(
      thirdCallIndex,
      activeGame,
      attackerId,
      defenderId,
      true,
      undefined,
    );
  });
});
