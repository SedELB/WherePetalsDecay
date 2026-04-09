import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { PlayerType } from '@common/enums';
import { Player } from '@common/player';

import { CombatComponent } from './combat.component';

describe('CombatComponent', () => {
  let component: CombatComponent;
  let fixture: ComponentFixture<CombatComponent>;
  let gameViewServiceMock: jasmine.SpyObj<Pick<GameViewService, 'gameLobby' | 'getCurrentCombatRoomId' | 'sendPostureChoice' | 'lastCombatResult'
    | 'combatRoundIndex' | 'combatPostureCountdown'>>;

  const createPlayer = (socketId: string, name: string): Player => ({
    socketId,
    character: {
      name,
      avatar: `${name}.png`,
      life: 10,
      speed: 4,
      attack: 4,
      defense: 4,
      lifeBonus: false,
      attackDice: 'D4',
      defenseDice: 'D4',
      bonusPosture: { type: null, bonus: 0 },
      debuf: 0,
    },
    winsCount: 0,
    isHost: false,
    hasAbandonned: false,
    playerType: PlayerType.Reel,
    hasFlag: false,
    combatCount: 0,
    lossCount: 0,
    totalHpLost: 0,
    totalHpDealt: 0,
    visitedTilesCount: 0,
  });

  beforeEach(async () => {
    gameViewServiceMock = jasmine.createSpyObj('GameViewService', [
      'gameLobby',
      'getCurrentCombatRoomId',
      'sendPostureChoice',
      'lastCombatResult',
      'combatRoundIndex',
      'combatPostureCountdown',
    ]);
    gameViewServiceMock.gameLobby.and.returnValue({ lobbyId: 'lobby-1' } as never);
    gameViewServiceMock.getCurrentCombatRoomId.and.returnValue('fight-1');
    gameViewServiceMock.lastCombatResult.and.returnValue(null);
    gameViewServiceMock.combatRoundIndex.and.returnValue(1);
    gameViewServiceMock.combatPostureCountdown.and.returnValue(0);

    await TestBed.configureTestingModule({
      imports: [CombatComponent],
      providers: [
        provideRouter([]),
        { provide: GameViewService, useValue: gameViewServiceMock },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(CombatComponent);
    component = fixture.componentInstance;
    component.player = createPlayer('player-1', 'Hero');
    component.enemy = createPlayer('enemy-1', 'Villain');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should send posture choice and close posture selection', () => {
    spyOn(component as never, 'showToast').and.stub();

    component.ngOnChanges();
    expect(component.isChoosingPosture).toBeTrue();

    component.choosePosture('atk');

    expect(component.isChoosingPosture).toBeFalse();
    expect(component.player.character.bonusPosture).toEqual({ type: 'atk', bonus: 2 });
    expect(gameViewServiceMock.sendPostureChoice).toHaveBeenCalledWith('lobby-1', 'fight-1', { type: 'atk', bonus: 2 });
  });

  it('should require a new posture after previous round posture reset', () => {
    spyOn(component as never, 'showToast').and.stub();

    component.ngOnChanges();
    component.choosePosture('def');
    expect(component.isChoosingPosture).toBeFalse();

    component.player.character.bonusPosture = { type: null, bonus: 0 };
    component.ngOnChanges();

    expect(component.isChoosingPosture).toBeTrue();
  });

  it('should notify enemy posture again even if same type on a new round', () => {
    const postureToastMessage = 'Posture adverse reçue. Le lancé de dés est disponible.';
    const showToastSpy = spyOn(component as never, 'showToast').and.stub();

    component.enemy.character.bonusPosture = { type: null, bonus: 0 };
    component.ngOnChanges();

    component.enemy.character.bonusPosture = { type: 'atk', bonus: 2 };
    component.ngOnChanges();

    component.enemy.character.bonusPosture = { type: null, bonus: 0 };
    component.ngOnChanges();

    component.enemy.character.bonusPosture = { type: 'atk', bonus: 2 };
    component.ngOnChanges();

    const postureToastCalls = showToastSpy.calls.allArgs().filter((args) => args[0] === postureToastMessage);
    expect(postureToastCalls.length).toBe(2);
  });
});
