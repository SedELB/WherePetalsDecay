import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GameCreationComponent } from './game-creation.component';
import { GameService } from '@app/services/game.service';
import { CharacterService } from '@app/services/character.service';
import { AVATARS, BASE_STATS, RANDOM_NAMES } from '@app/interfaces/character';

const LIFE_WITH_BONUS = BASE_STATS.life + BASE_STATS.bonus;
const SPEED_WITH_BONUS = BASE_STATS.speed + BASE_STATS.bonus;
const TEST_AVATAR_INDEX = 5;
const TEST_AVATAR_INDEX_ALT = 3;

describe('GameCreationComponent', () => {
    let component: GameCreationComponent;
    let fixture: ComponentFixture<GameCreationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameCreationComponent, HttpClientTestingModule],
            providers: [
                provideRouter([]),
                GameService,
                CharacterService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCreationComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should start with game-selection phase', () => {
        expect(component.currentPhase).toBe('game-selection');
    });

    it('should have empty games array initially', () => {
        expect(component.games).toEqual([]);
    });

    it('should select avatar when clicked', () => {
        component.selectAvatar(TEST_AVATAR_INDEX);
        expect(component.selectedAvatarIndex).toBe(TEST_AVATAR_INDEX);
    });

    it('should have life value with bonus when life bonus is selected', () => {
        component.lifeBonusSelected = true;
        expect(component.lifeValue).toBe(LIFE_WITH_BONUS);
    });

    it('should have speed value with bonus when speed bonus is selected', () => {
        component.lifeBonusSelected = false;
        expect(component.speedValue).toBe(SPEED_WITH_BONUS);
    });

    it('should have life value of base when speed bonus is selected', () => {
        component.lifeBonusSelected = false;
        expect(component.lifeValue).toBe(BASE_STATS.life);
    });

    it('should have speed value of base when life bonus is selected', () => {
        component.lifeBonusSelected = true;
        expect(component.speedValue).toBe(BASE_STATS.speed);
    });

    it('should have attack value of base', () => {
        expect(component.attackValue).toBe(BASE_STATS.attack);
    });

    it('should have defense value of base', () => {
        expect(component.defenseValue).toBe(BASE_STATS.defense);
    });

    it('should assign D6 to attack and D4 to defense when attackDiceD6 is true', () => {
        component.attackDiceD6 = true;
        expect(component.attackDice).toBe('D6');
        expect(component.defenseDice).toBe('D4');
    });

    it('should assign D4 to attack and D6 to defense when attackDiceD6 is false', () => {
        component.attackDiceD6 = false;
        expect(component.attackDice).toBe('D4');
        expect(component.defenseDice).toBe('D6');
    });

    it('should select life bonus when selectBonus is called with true', () => {
        component.selectBonus(true);
        expect(component.lifeBonusSelected).toBe(true);
    });

    it('should select speed bonus when selectBonus is called with false', () => {
        component.selectBonus(false);
        expect(component.lifeBonusSelected).toBe(false);
    });

    it('should select attack dice D6 when selectAttackDice is called with true', () => {
        component.selectAttackDice(true);
        expect(component.attackDiceD6).toBe(true);
    });

    it('should select defense dice D6 when selectAttackDice is called with false', () => {
        component.selectAttackDice(false);
        expect(component.attackDiceD6).toBe(false);
    });

    it('should go back to game selection and reset form', () => {
        component.currentPhase = 'character-creation';
        component.selectedGame = null;
        component.characterName = 'Test Character';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX_ALT;

        component.goBackToGameSelection();

        expect(component.currentPhase).toBe('game-selection');
        expect(component.selectedGame).toBeNull();
        expect(component.characterName).toBe('');
        expect(component.selectedAvatarIndex).toBeNull();
    });

    it('should reset character form', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        component.lifeBonusSelected = false;
        component.attackDiceD6 = false;

        component.resetCharacterForm();

        expect(component.characterName).toBe('');
        expect(component.selectedAvatarIndex).toBeNull();
        expect(component.lifeBonusSelected).toBe(true);
        expect(component.attackDiceD6).toBe(true);
    });

    it('should generate random character with valid values', () => {
        component.generateRandomCharacter();

        expect(component.characterName).toBeTruthy();
        expect(RANDOM_NAMES).toContain(component.characterName);
        expect(component.selectedAvatarIndex).not.toBeNull();
        expect(component.selectedAvatarIndex).toBeGreaterThanOrEqual(0);
        expect(component.selectedAvatarIndex).toBeLessThan(AVATARS.length);
    });

    it('should not navigate when form is invalid', () => {
        component.characterName = '';
        component.selectedAvatarIndex = null;
        const navigateSpy = spyOn(component['router'], 'navigate');

        component.confirmCharacter();

        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should validate form as invalid when name is empty', () => {
        component.characterName = '';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        expect(component.isFormValid()).toBe(false);
    });

    it('should validate form as invalid when avatar is not selected', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = null;
        expect(component.isFormValid()).toBe(false);
    });

    it('should validate form as valid when name and avatar are set', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        expect(component.isFormValid()).toBe(true);
    });

    it('should validate form as invalid when name is only whitespace', () => {
        component.characterName = '   ';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        expect(component.isFormValid()).toBe(false);
    });
});