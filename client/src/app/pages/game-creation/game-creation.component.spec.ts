import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameCreationComponent } from './game-creation.component';
import { AVATARS, RANDOM_NAMES } from '@app/interfaces/character';

describe('GameCreationComponent', () => {
    let component: GameCreationComponent;
    let fixture: ComponentFixture<GameCreationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameCreationComponent],
            providers: [provideRouter([])],
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

    it('should switch to character-creation phase when game is selected', () => {
        component.selectGame('Test Game');
        expect(component.currentPhase).toBe('character-creation');
        expect(component.selectedGame).toBe('Test Game');
    });

    it('should select avatar when clicked', () => {
        const avatarIndex = 5;
        component.selectAvatar(avatarIndex);
        expect(component.selectedAvatarIndex).toBe(avatarIndex);
    });

    it('should have life value of 8 when life bonus is selected', () => {
        component.lifeBonusSelected = true;
        expect(component.lifeValue).toBe(8);
    });

    it('should have speed value of 8 when speed bonus is selected', () => {
        component.lifeBonusSelected = false;
        expect(component.speedValue).toBe(8);
    });

    it('should have life value of 6 when speed bonus is selected', () => {
        component.lifeBonusSelected = false;
        expect(component.lifeValue).toBe(6);
    });

    it('should have speed value of 6 when life bonus is selected', () => {
        component.lifeBonusSelected = true;
        expect(component.speedValue).toBe(6);
    });

    it('should have attack value of 4', () => {
        expect(component.attackValue).toBe(4);
    });

    it('should have defense value of 4', () => {
        expect(component.defenseValue).toBe(4);
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
        component.selectedGame = 'Test Game';
        component.characterName = 'Test Character';
        component.selectedAvatarIndex = 3;

        component.goBackToGameSelection();

        expect(component.currentPhase).toBe('game-selection');
        expect(component.selectedGame).toBeNull();
        expect(component.characterName).toBe('');
        expect(component.selectedAvatarIndex).toBeNull();
    });

    it('should reset character form', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = 5;
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

    it('should validate form as invalid when name is empty', () => {
        component.characterName = '';
        component.selectedAvatarIndex = 5;
        expect(component.isFormValid()).toBe(false);
    });

    it('should validate form as invalid when avatar is not selected', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = null;
        expect(component.isFormValid()).toBe(false);
    });

    it('should validate form as valid when name and avatar are set', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = 5;
        expect(component.isFormValid()).toBe(true);
    });

    it('should validate form as invalid when name is only whitespace', () => {
        component.characterName = '   ';
        component.selectedAvatarIndex = 5;
        expect(component.isFormValid()).toBe(false);
    });
});