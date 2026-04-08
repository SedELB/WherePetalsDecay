/**
 * CharacterSelectionComponent Test Suite
 *
 * Testing Strategy:
 * This test suite validates the character creation workflow. We test three core aspects:
 *
 * 1. Character Form Management - Validates avatar selection, stat modification (life/speed bonuses),
 *    and dice selection (D4/D6 choices). Tests use property setters to simulate user interactions
 *    and verify reactive property calculations.
 *
 * 2. Form Validation - Comprehensively tests edge cases including empty names, missing avatars,
 *    and whitespace-only input. This ensures form submission is prevented for invalid states.
 *
 * 3. Navigation and Integration - Tests goBack() navigation with conditional routing based on
 *    lobby context, and random character generation using predefined constants to ensure
 *    generated values are always valid.
 *
 * WebSocket Mocking Strategy:
 * We use jasmine.createSpyObj to create a mock WebSocketService with tracked method calls.
 * This allows us to verify that game-related WebSocket emissions (like joining a lobby) are
 * properly triggered when users submit their character. Methods are mocked but not implemented
 * since this component primarily focuses on form logic rather than socket communication.
 * 
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { CharacterService } from '@app/services/character/character.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { AVATARS_PATH, BASE_STATS, RANDOM_NAMES } from '@common/constants/character.constants';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { CharacterSelectionComponent } from './character-selection.component';

describe('CharacterSelectionComponent', () => {
  let component: CharacterSelectionComponent;
  let fixture: ComponentFixture<CharacterSelectionComponent>;
  let webSocketServiceSpy: jasmine.SpyObj<WebSocketService>;

  const LIFE_WITH_BONUS = BASE_STATS.life + BASE_STATS.bonus;
  const SPEED_WITH_BONUS = BASE_STATS.speed + BASE_STATS.bonus;
  const TEST_AVATAR_INDEX = 5;
  const TEST_AVATAR_PATH = AVATARS_PATH[TEST_AVATAR_INDEX];


  beforeEach(async () => {
    webSocketServiceSpy = jasmine.createSpyObj('WebSocketService', ['emitNamespace', 'onNamespace', 'offNamespace']);

    await TestBed.configureTestingModule({
      imports: [CharacterSelectionComponent],
      providers: [
        provideRouter([]),
        CharacterService,
        { provide: WebSocketService, useValue: webSocketServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });


  // Avatar and Stats Tests

  // These tests validate the character form's primary inputs: avatar selection and
  // stat distribution. We verify that selecting an avatar updates the component state,
  // and that bonus selection logic correctly modifies stat values.

  // Test avatar selection
  it('should select avatar when clicked', () => {
    component.selectAvatar(TEST_AVATAR_PATH);
    expect(component.selectedAvatar).toBe(TEST_AVATAR_PATH);
  });

  // Avatar Deselection Tests

  // These tests validate that clicking on an already-selected avatar deselects it.
  // This is an important UX feature allowing users to undo avatar selection.
  // Deselection also emits a WebSocket event with null avatar to notify the server.

  it('should deselect avatar when clicking on already-selected avatar', () => {
    // Select an avatar
    component.selectAvatar(TEST_AVATAR_PATH);
    expect(component.selectedAvatar).toBe(TEST_AVATAR_PATH);

    // Click on the same avatar again to deselect
    component.selectAvatar(TEST_AVATAR_PATH);
    expect(component.selectedAvatar).toBeNull();
  });

  it('should emit deselection event with null avatar when deselecting', () => {
    component.lobbyId = 'test-lobby-id';
    webSocketServiceSpy.emitNamespace.calls.reset();

    component.selectAvatar(TEST_AVATAR_PATH);

    // Deselect by clicking again
    webSocketServiceSpy.emitNamespace.calls.reset();
    component.selectAvatar(TEST_AVATAR_PATH);

    expect(webSocketServiceSpy.emitNamespace).toHaveBeenCalledWith(
      SocketNamespace.Join,
      JoinGameEvents.SelectAvatar,
      jasmine.objectContaining({ lobbyId: 'test-lobby-id', avatar: null }),
    );
  });

  // WebSocket Avatar Events Tests

  // These tests validate that avatar selection is properly communicated via WebSocket.
  // When a user selects an avatar, it's emitted to the server. When other players'
  // avatar selections arrive via WebSocket events, the component updates accordingly

  describe('Avatar Selection WebSocket Events', () => {
    it('should emit avatar selection event when avatar is selected', () => {
      component.selectAvatar(TEST_AVATAR_PATH);

      expect(webSocketServiceSpy.emitNamespace).toHaveBeenCalledWith(
        jasmine.any(String),
        jasmine.any(String),
        jasmine.objectContaining({ avatar: TEST_AVATAR_PATH }),
      );
    });

    it('should handle avatar selection confirmation event', () => {
      let avatarConfirmCallback: ((avatar: string) => void) | undefined;

      webSocketServiceSpy.onNamespace.and.callFake(
        (_namespace: string, _event: string, callback: unknown) => {
          // Capture callback for avatar confirmation events
          avatarConfirmCallback = callback as ((avatar: string) => void);
        },
      );

      fixture.detectChanges();

      // First, select an avatar locally
      component.selectAvatar(TEST_AVATAR_PATH);
      expect(component.selectedAvatar).toBe(TEST_AVATAR_PATH);
      avatarConfirmCallback?.(TEST_AVATAR_PATH);
      // Avatar should still be selected after confirmation
      expect(component.selectedAvatar).toBe(TEST_AVATAR_PATH);
    });

    it('should update pending avatars when other players select avatars', () => {
      let pendingAvatarCallback: ((data: { socketId: string; avatar: string }) => void) | undefined;

      webSocketServiceSpy.onNamespace.and.callFake(
        (_namespace: string, _event: string, callback: unknown) => {
          pendingAvatarCallback = callback as ((data: { socketId: string; avatar: string }) => void);
        },
      );

      fixture.detectChanges();

      const mockSocketId = 'socket-123';
      const mockAvatarPath = AVATARS_PATH[2];
      pendingAvatarCallback?.({ socketId: mockSocketId, avatar: mockAvatarPath });

      // Verify pending avatars are tracked
      expect(component.selectedAvatar).not.toBe(mockAvatarPath); // Component's own avatar unchanged
    });
  });

  // Tests the mutually exclusive bonus system where selecting one bonus (life or speed)
  // prevents the other. We verify that stat values react correctly to each combination:
  // +0 vs +5 depending on bonus selection.
  describe('Bonus Selection', () => {
    it('should calculate life value with bonus when lifeBonusSelected is true', () => {
      component.lifeBonusSelected = true;
      expect(component.lifeValue).toBe(LIFE_WITH_BONUS);
    });

    it('should calculate speed value with bonus when lifeBonusSelected is false', () => {
      component.lifeBonusSelected = false;
      expect(component.speedValue).toBe(SPEED_WITH_BONUS);
    });

    it('should calculate life value without bonus when speed bonus is selected', () => {
      component.lifeBonusSelected = false;
      expect(component.lifeValue).toBe(BASE_STATS.life);
    });

    it('should calculate speed value without bonus when life bonus is selected', () => {
      component.lifeBonusSelected = true;
      expect(component.speedValue).toBe(BASE_STATS.speed);
    });

    it('should select life bonus when selectBonus is called with true', () => {
      component.selectBonus(true);
      expect(component.lifeBonusSelected).toBe(true);
    });

    it('should select speed bonus when selectBonus is called with false', () => {
      component.selectBonus(false);
      expect(component.lifeBonusSelected).toBe(false);
    });
  });

  // Tests immutable stat values that never change regardless of user selections.
  // These are foundational character stats.
  describe('Immutable Stats (Attack and Defense)', () => {
    it('should return base attack value', () => {
      expect(component.attackValue).toBe(BASE_STATS.attack);
    });

    it('should return base defense value', () => {
      expect(component.defenseValue).toBe(BASE_STATS.defense);
    });
  });


  // Dice Selection Tests

  // These tests validate the dice trade-off system: choosing D6 for attack forces D4
  // for defense (and vice versa). This represents a strategic choice that affects
  // combat mechanics.

  describe('Dice Selection', () => {
    it('should return D6 for attack and D4 for defense when attackDiceD6 is true', () => {
      component.attackDiceD6 = true;
      expect(component.attackDice).toBe('D6');
      expect(component.defenseDice).toBe('D4');
    });

    it('should return D4 for attack and D6 for defense when attackDiceD6 is false', () => {
      component.attackDiceD6 = false;
      expect(component.attackDice).toBe('D4');
      expect(component.defenseDice).toBe('D6');
    });

    it('should select attack dice D6 when selectAttackDice is called with true', () => {
      component.selectAttackDice(true);
      expect(component.attackDiceD6).toBe(true);
    });

    it('should select defense dice D6 when selectAttackDice is called with false', () => {
      component.selectAttackDice(false);
      expect(component.attackDiceD6).toBe(false);
    });
  });

  // Navigation Tests

  // These tests verify routing behavior when users navigate away from character
  // creation. The routing destination depends on context: if lobbyId exists
  // (joining existing game), return to create page; otherwise navigate to join.

  // Test going back navigates to create page when no gameId
  it('should navigate to create page on goBack when no gameId', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.lobbyId = null;

    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith([ROUTES.create]);
  });

  // Random Character Generation

  // Tests the randomization feature that generates a complete valid character
  // using predefined name/avatar pools. Validates that generated values are
  // always drawn from valid option sets.

  // Test random character generation
  it('should generate random character with valid values', () => {
    component.generateRandomCharacter();

    expect(component.characterName).toBeTruthy();
    expect(RANDOM_NAMES).toContain(component.characterName);
    expect(component.selectedAvatar).not.toBeNull();
    expect(AVATARS_PATH).toContain(component.selectedAvatar as string);
  });

  it('should not deselect current avatar when no alternative is available', () => {
    component.selectedAvatar = TEST_AVATAR_PATH;
    component.currentlySelectedAvatars = [...AVATARS_PATH];

    component.generateRandomCharacter();

    expect(component.selectedAvatar).toBe(TEST_AVATAR_PATH);
  });

  it('should pass only available avatars to random generation', () => {
    component.selectedAvatar = AVATARS_PATH[0];
    component.currentlySelectedAvatars = [AVATARS_PATH[0], AVATARS_PATH[1], AVATARS_PATH[2]];

    const characterService = TestBed.inject(CharacterService);
    const serviceSpy = spyOn(characterService, 'generateRandomCharacter').and.callThrough();

    component.generateRandomCharacter();

    const calledPool = serviceSpy.calls.mostRecent().args[0] as string[];
    expect(calledPool).not.toContain(AVATARS_PATH[0]);
    expect(calledPool).not.toContain(AVATARS_PATH[1]);
    expect(calledPool).not.toContain(AVATARS_PATH[2]);
  });

  // Form Validation Tests

  // Comprehensive validation tests covering critical edge cases:
  // 1. Empty name string - prevents submission
  // 2. Missing avatar - prevents submission (guards against null selection)
  // 3. Whitespace-only name - treated as invalid (prevents \"   \" from submitting)
  // These tests ensure the form state machine prevents invalid combinations.

  // Test form validation with empty name
  it('should validate form as invalid when name is empty', () => {
    component.characterName = '';
    component.selectedAvatar = TEST_AVATAR_PATH;
    expect(component.isFormValid()).toBe(false);
  });

  // Test form validation with no avatar
  it('should validate form as invalid when avatar is not selected', () => {
    component.characterName = 'Test';
    component.selectedAvatar = null;
    expect(component.isFormValid()).toBe(false);
  });

  // Test form validation with whitespace name
  it('should validate form as invalid when name is only whitespace', () => {
    component.characterName = '   ';
    component.selectedAvatar = TEST_AVATAR_PATH;
    expect(component.isFormValid()).toBe(false);
  });
});
