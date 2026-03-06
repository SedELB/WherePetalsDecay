/**
 * Testing:
 * - Character creation form (name, avatar, stats, dice)
 * - Form validation and navigation
 * - Random character generation
 */

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { CharacterService } from '@app/services/character/character.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { AVATARS_PATH, BASE_STATS, RANDOM_NAMES } from '@common/character';
import { CharacterSelectionComponent } from './character-selection.component';

describe('CharacterSelectionComponent', () => {
  let component: CharacterSelectionComponent;
  let fixture: ComponentFixture<CharacterSelectionComponent>;
  let webSocketServiceSpy: jasmine.SpyObj<WebSocketService>;

  const LIFE_WITH_BONUS = BASE_STATS.life + BASE_STATS.bonus;
  const SPEED_WITH_BONUS = BASE_STATS.speed + BASE_STATS.bonus;
  const TEST_AVATAR_INDEX = 5;

  beforeEach(async () => {
    webSocketServiceSpy = jasmine.createSpyObj('WebSocketService', ['emitNamespace', 'onNamespace', 'offNamespace']);

    await TestBed.configureTestingModule({
      imports: [CharacterSelectionComponent, HttpClientTestingModule],
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

  // Test avatar selection
  it('should select avatar when clicked', () => {
    component.selectAvatar(TEST_AVATAR_INDEX);
    expect(component.selectedAvatarIndex).toBe(TEST_AVATAR_INDEX);
  });

  // Test life bonus calculation
  it('should calculate life value with bonus when life bonus is selected', () => {
    component.lifeBonusSelected = true;
    expect(component.lifeValue).toBe(LIFE_WITH_BONUS);
  });

  // Test speed bonus calculation
  it('should calculate speed value with bonus when speed bonus is selected', () => {
    component.lifeBonusSelected = false;
    expect(component.speedValue).toBe(SPEED_WITH_BONUS);
  });

  // Test life value without bonus
  it('should calculate life value without bonus when speed bonus is selected', () => {
    component.lifeBonusSelected = false;
    expect(component.lifeValue).toBe(BASE_STATS.life);
  });

  // Test speed value without bonus
  it('should calculate speed value without bonus when life bonus is selected', () => {
    component.lifeBonusSelected = true;
    expect(component.speedValue).toBe(BASE_STATS.speed);
  });

  // Test attack value getter
  it('should return base attack value', () => {
    expect(component.attackValue).toBe(BASE_STATS.attack);
  });

  // Test defense value getter
  it('should return base defense value', () => {
    expect(component.defenseValue).toBe(BASE_STATS.defense);
  });

  // Test attack dice D6
  it('should return D6 for attack and D4 for defense when attackDiceD6 is true', () => {
    component.attackDiceD6 = true;
    expect(component.attackDice).toBe('D6');
    expect(component.defenseDice).toBe('D4');
  });

  // Test attack dice D4
  it('should return D4 for attack and D6 for defense when attackDiceD6 is false', () => {
    component.attackDiceD6 = false;
    expect(component.attackDice).toBe('D4');
    expect(component.defenseDice).toBe('D6');
  });

  // Test selecting life bonus
  it('should select life bonus when selectBonus is called with true', () => {
    component.selectBonus(true);
    expect(component.lifeBonusSelected).toBe(true);
  });

  // Test selecting speed bonus
  it('should select speed bonus when selectBonus is called with false', () => {
    component.selectBonus(false);
    expect(component.lifeBonusSelected).toBe(false);
  });

  // Test selecting attack dice D6
  it('should select attack dice D6 when selectAttackDice is called with true', () => {
    component.selectAttackDice(true);
    expect(component.attackDiceD6).toBe(true);
  });

  // Test selecting defense dice D6
  it('should select defense dice D6 when selectAttackDice is called with false', () => {
    component.selectAttackDice(false);
    expect(component.attackDiceD6).toBe(false);
  });

  // Test going back navigates to create page when no gameId
  it('should navigate to create page on goBack when no gameId', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.gameId = null;

    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith([ROUTES.create]);
  });

  // Test random character generation
  it('should generate random character with valid values', () => {
    component.generateRandomCharacter();

    expect(component.characterName).toBeTruthy();
    expect(RANDOM_NAMES).toContain(component.characterName);
    expect(component.selectedAvatarIndex).not.toBeNull();
    expect(component.selectedAvatarIndex).toBeGreaterThanOrEqual(0);
    expect(component.selectedAvatarIndex).toBeLessThan(AVATARS_PATH.length);
  });

  // Test form validation with empty name
  it('should validate form as invalid when name is empty', () => {
    component.characterName = '';
    component.selectedAvatarIndex = TEST_AVATAR_INDEX;
    expect(component.isFormValid()).toBe(false);
  });

  // Test form validation with no avatar
  it('should validate form as invalid when avatar is not selected', () => {
    component.characterName = 'Test';
    component.selectedAvatarIndex = null;
    expect(component.isFormValid()).toBe(false);
  });

  // Test form validation with whitespace name
  it('should validate form as invalid when name is only whitespace', () => {
    component.characterName = '   ';
    component.selectedAvatarIndex = TEST_AVATAR_INDEX;
    expect(component.isFormValid()).toBe(false);
  });
});
