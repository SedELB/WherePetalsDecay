import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GameCreationComponent } from './game-creation.component';
import { GameService } from '@app/services/game.service';
import { CharacterService } from '@app/services/character.service';
import { BASE_STATS } from '@app/interfaces/character';

const LIFE_WITH_BONUS = BASE_STATS.life + BASE_STATS.bonus;
const SPEED_WITH_BONUS = BASE_STATS.speed + BASE_STATS.bonus;
const TEST_AVATAR_INDEX = 5;

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

    it('should have life value of 8 when life bonus is selected', () => {
        component.lifeBonusSelected = true;
        expect(component.lifeValue).toBe(LIFE_WITH_BONUS);
    });

    it('should have speed value of 8 when speed bonus is selected', () => {
        component.lifeBonusSelected = false;
        expect(component.speedValue).toBe(SPEED_WITH_BONUS);
    });

    it('should have attack dice D6 when attackDiceD6 is true', () => {
        component.attackDiceD6 = true;
        expect(component.attackDice).toBe('D6');
        expect(component.defenseDice).toBe('D4');
    });

    it('should have defense dice D6 when attackDiceD6 is false', () => {
        component.attackDiceD6 = false;
        expect(component.attackDice).toBe('D4');
        expect(component.defenseDice).toBe('D6');
    });

    it('should reset form when going back to game selection', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        component.goBackToGameSelection();
        expect(component.characterName).toBe('');
        expect(component.selectedAvatarIndex).toBeNull();
        expect(component.currentPhase).toBe('game-selection');
    });

    it('should validate form as invalid when name is empty', () => {
        component.characterName = '';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        expect(component.isFormValid()).toBe(false);
    });

    it('should validate form as valid when name and avatar are set', () => {
        component.characterName = 'Test';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX;
        expect(component.isFormValid()).toBe(true);
    });
});