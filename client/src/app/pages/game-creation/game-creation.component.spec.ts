/**
 * Testing:
 * - Component lifecycle (ngOnInit, ngOnDestroy)
 * - Game selection and visibility updates via socket
 * - Character creation form (name, avatar, stats, dice)
 * - Form validation and navigation
 * - Page rendering and state switching
 */

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AVATARS_PATH, BASE_STATS, RANDOM_NAMES } from '@common/character';
import { Game } from '@common/game';
import { CharacterService } from '@app/services/character/character.service';
import { PlayerGameService } from '@app/services/game-creation/game-creation.service';
import { GameMode } from '@common/enums';
import { BehaviorSubject, of } from 'rxjs';
import { GameCreationComponent } from './game-creation.component';

describe('GameCreationComponent', () => {
    let component: GameCreationComponent;
    let fixture: ComponentFixture<GameCreationComponent>;
    let playerGameService: jasmine.SpyObj<PlayerGameService>;
    let visibleGamesSubject: BehaviorSubject<Game[]>;

    const LIFE_WITH_BONUS = BASE_STATS.life + BASE_STATS.bonus;
    const SPEED_WITH_BONUS = BASE_STATS.speed + BASE_STATS.bonus;
    const TEST_AVATAR_INDEX = 5;
    const TEST_AVATAR_INDEX_ALT = 3;

    const MOCK_GAMES: Game[] = [
        {
            _id: '1',
            name: 'Test1',
            description: 'test1description',
            size: { rows: 20, cols: 20 },
            gameMode: GameMode.Classic,
            thumbnail: 'thumb',
            maxPlayers: 6,
            grid: [],
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-01-15'),
            isVisible: true,
        },
        {
            _id: '2',
            name: 'Test2',
            description: 'test2description',
            size: { rows: 10, cols: 10 },
            gameMode: GameMode.Ctf,
            thumbnail: 'thumb',
            maxPlayers: 2,
            grid: [],
            createdAt: new Date('2024-02-10'),
            updatedAt: new Date('2024-02-10'),
            isVisible: true,
        },
        {
            _id: '3',
            name: 'Test3',
            description: 'test3description',
            size: { rows: 15, cols: 15 },
            gameMode: GameMode.Classic,
            thumbnail: 'thumb',
            maxPlayers: 4,
            grid: [],
            createdAt: new Date('2024-03-01'),
            updatedAt: new Date('2024-03-01'),
            isVisible: false,
        },
    ];

    beforeEach(async () => {
        // Mock BehaviorSubject for visible games stream
        visibleGamesSubject = new BehaviorSubject<Game[]>(MOCK_GAMES);

        // Mock PlayerGameService
        playerGameService = jasmine.createSpyObj(
            'PlayerGameService',
            ['fetchVisibleGames', 'setGames'],
            { visibleGames$: visibleGamesSubject.asObservable() },
        );

        // Make fetchVisibleGames return our mock data
        playerGameService.fetchVisibleGames.and.returnValue(of(MOCK_GAMES));

        // Configure the testing module
        await TestBed.configureTestingModule({
            imports: [GameCreationComponent, HttpClientTestingModule],
            providers: [
                provideRouter([]),
                { provide: PlayerGameService, useValue: playerGameService },
                CharacterService,
            ],
        }).compileComponents();

        // Create component instance
        fixture = TestBed.createComponent(GameCreationComponent);
        component = fixture.componentInstance;
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    // Fetch visible games on component construction
    it('should call fetchVisibleGames on ngOnInit', () => {
        fixture.detectChanges();
        expect(playerGameService.fetchVisibleGames).toHaveBeenCalled();
    });

    // Successful call of fetchVisibleGames
    it('should call setGames with fetched games on successful fetch', () => {
        fixture.detectChanges();
        expect(playerGameService.setGames).toHaveBeenCalledWith(MOCK_GAMES);
    });

    // Testing the subscription to visibleGames$, websocket
    it('should subscribe to visibleGames$ and fill games array', () => {
        fixture.detectChanges();
        expect(component.games.length).toBe(MOCK_GAMES.length);
    });

    // Make sure the ordering that appears is right
    it('should sort games by createdAt in ascending order', () => {
        fixture.detectChanges();
        expect(component.games[0].name).toBe('Test1');
        expect(component.games[1].name).toBe('Test2');
        expect(component.games[2].name).toBe('Test3');
    });

    // Handling possible backend type missmatch
    it('should handle createdAt as string when sorting', () => {
        const gamesWithStringDates: Game[] = [
            { ...MOCK_GAMES[0], createdAt: '2024-01-01' as unknown as Date },
            { ...MOCK_GAMES[1], createdAt: '2024-03-01' as unknown as Date },
        ];

        visibleGamesSubject.next(gamesWithStringDates);
        fixture.detectChanges();

        expect(component.games[0].name).toBe('Test1');
        expect(component.games[1].name).toBe('Test2');
    });

    // Stop the tracking visibleGames$ when the component is destroyed
    it('should unsubscribe from visibleGames$ on ngOnDestroy', () => {
        fixture.detectChanges();

        const subscription = component['gamesSubscription'];
        if (subscription) {
            spyOn(subscription, 'unsubscribe');
        }

        component.ngOnDestroy();

        if (subscription) {
            expect(subscription.unsubscribe).toHaveBeenCalled();
        }
    });

    // Testing for possible undefined games$ subscription
    it('should not throw error in ngOnDestroy if subscription is undefined', () => {
        component['gamesSubscription'] = null;
        expect(() => component.ngOnDestroy()).not.toThrow();
    });

    // We should be in the game-selection state on component construction
    it('should start with game-selection phase', () => {
        expect(component.currentPhase).toBe('game-selection');
    });

    // No game should be selected initially
    it('should have no game selected initially', () => {
        expect(component.selectedGame).toBeNull();
    });

    // When we select a game, the state change to character creation
    it('should select game and switch to character creation phase', () => {
        fixture.detectChanges();
        const game = MOCK_GAMES[0];

        component.selectGame(game);

        expect(component.selectedGame).toBe(game);
        expect(component.currentPhase).toBe('character-creation');
    });

    // When a player selects a game they can continue even if admin delete it
    it('should keep selected game even when removed from visible games list', () => {
        fixture.detectChanges();
        const selectedGame = MOCK_GAMES[0];
        component.selectedGame = selectedGame;
        component.currentPhase = 'character-creation';

        visibleGamesSubject.next([MOCK_GAMES[1], MOCK_GAMES[2]]);

        expect(component.selectedGame).toBe(selectedGame);
        expect(component.currentPhase).toBe('character-creation');
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

    // Test going back to game selection
    it('should go back to game selection and reset form', () => {
        component.currentPhase = 'character-creation';
        component.selectedGame = MOCK_GAMES[0];
        component.characterName = 'Test Character';
        component.selectedAvatarIndex = TEST_AVATAR_INDEX_ALT;

        component.goBackToGameSelection();

        expect(component.currentPhase).toBe('game-selection');
        expect(component.selectedGame).toBeNull();
        expect(component.characterName).toBe('');
        expect(component.selectedAvatarIndex).toBeNull();
    });

    // Test resetting character form
    it('should reset character form to default values', () => {
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

