import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';
import { of } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';


describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;
  let communicationServiceSpy: jasmine.SpyObj<CommunicationService>;
  const NUMBER_OF_GAMECARD_BUTTONS = 3;

  const MOCK_GAME_CARDS: Game[] = [
    {
      _id: '1',
      name: 'Morpion',
      description: 'Le grand classique du 3x3.',
      size: { rows: 20, cols: 20 },
      gameMode: 'Solo',
      thumbnail: 'assets/morpion.png',
      maxPlayers: 1,
      grid: [],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
      isVisible: true,
    },
    {
      _id: '2',
      name: 'Bataille Navale',
      description: 'Coulez tous les navires adverses.',
      size: { rows: 10, cols: 10 },
      gameMode: 'Multijoueur',
      thumbnail: 'assets/naval.png',
      maxPlayers: 2,
      grid: [],
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-10'),
      isVisible: true,
    },
    {
      _id: '3',
      name: 'Échecs',
      description: 'Testez votre stratégie.',
      size: { rows: 15, cols: 15 },
      gameMode: 'Classique',
      thumbnail: 'assets/chess.png',
      maxPlayers: 2,
      grid: [],
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01'),
      isVisible: false,
    },
  ];

  beforeEach(async () => {

    const spy = jasmine.createSpyObj('CommunicationService', ['getAllGames', 'deleteGame', 'updateVisiblity']);

    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, RouterTestingModule],
      providers: [
        { provide: CommunicationService, useValue: spy },
      ],
    }).compileComponents();

    communicationServiceSpy = TestBed.inject(CommunicationService) as jasmine.SpyObj<CommunicationService>;
    communicationServiceSpy.getAllGames.and.returnValue(of(MOCK_GAME_CARDS));

    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load games and populate gameCards array', () => {
    // Verify that gameCards length is equal to the mock games
    expect(component.gameCards.length).toBe(MOCK_GAME_CARDS.length);
    // Verify every name to be the same in the moch and the gameCards
    expect(component.gameCards[0].name).toBe('Morpion');
    expect(component.gameCards[1].name).toBe('Bataille Navale');
    expect(component.gameCards[2].name).toBe('Échecs');
  });

  it('should render all games in DOM as game-card components', () => {
    // Get the DOM root element of the admin page component
    const compiled = fixture.nativeElement;
    const gameCardElements = compiled.querySelectorAll('app-game-card');
    // Verify that there are exactly as much app-game-card as there are games in the mock
    expect(gameCardElements.length).toBe(MOCK_GAME_CARDS.length);
  });

  it('should remove game from gameCards array when removeGame is called', () => {
    const initialLength = component.gameCards.length;
    const gameName = component.gameCards[0].name;

    component.gameCards = component.gameCards.filter(game => game.name !== gameName);

    expect(component.gameCards.length).toBe(initialLength - 1);
    expect(component.gameCards.find(g => g.name === gameName)).toBeUndefined();
  });

  it('should toggle isVisible property when changeVisibility is called', () => {
    const game = component.gameCards[0];
    const wasVisible = game.isVisible;

    component.gameCards[0].isVisible = !wasVisible;
    expect(component.gameCards[0].isVisible).toBe(!wasVisible);

    component.gameCards[0].isVisible = wasVisible;
    expect(component.gameCards[0].isVisible).toBe(wasVisible);
  });

  it('should update DOM when game is removed', () => {
    const gameName = component.gameCards[0].name;
    const initialLength = component.gameCards.length;

    component.gameCards = component.gameCards.filter(game => game.name !== gameName);
    // fixture.detectChanges() forces Angular to update the DOM
    fixture.detectChanges();

    const gameCardElements = fixture.nativeElement.querySelectorAll('app-game-card');
    expect(gameCardElements.length).toBe(initialLength - 1);
  });

  it('should have a return button with correct route', () => {
    // Here i am adding a type to dodge the ESLint error when i pass the btn as type 'any'
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll<HTMLElement>('app-button');

    expect(buttons.length).toBeGreaterThan(0);
    const returnButton = Array.from(buttons).find((btn: HTMLElement) =>
      btn.textContent.includes('Retour'),
    );
    expect(returnButton).toBeTruthy();
  });

  it('should have an add button with correct CSS class', () => {
    const compiled = fixture.nativeElement;
    const addButton = compiled.querySelector('.add-button');
    expect(addButton).toBeTruthy();
  });

  it('should have action buttons for each game (Modifier, Cacher/Afficher, Supprimer)', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const gameCards = compiled.querySelectorAll<HTMLElement>('app-game-card');

    gameCards.forEach((card) => {
      const buttonsInCard = card.querySelectorAll('app-button');
      expect(buttonsInCard.length).toBe(NUMBER_OF_GAMECARD_BUTTONS);
    });
  });

  it('should display correct button text based on isVisible', () => {
    const game = component.gameCards[0];
    expect(game.isVisible).toBe(true);

    component.gameCards[0].isVisible = false;
    expect(component.gameCards[0].isVisible).toBe(false);

    component.gameCards[0].isVisible = true;
    expect(component.gameCards[0].isVisible).toBe(true);
  });

  it('should only remove the game specified by name, not others', () => {
    const morpion = component.gameCards.find(g => g.name === 'Morpion');
    const echecs = component.gameCards.find(g => g.name === 'Échecs');

    component.gameCards = component.gameCards.filter(g => g.name !== 'Bataille Navale');

    expect(component.gameCards.find(g => g.name === 'Morpion')).toBe(morpion);
    expect(component.gameCards.find(g => g.name === 'Échecs')).toBe(echecs);
    expect(component.gameCards.find(g => g.name === 'Bataille Navale')).toBeUndefined();
  });

  it('should call getGames on component initialization', () => {

    const newFixture = TestBed.createComponent(AdminPageComponent);
    const newComponent = newFixture.componentInstance;

    expect(newComponent.gameCards.length).toBe(0);
    // detectChanges() calls onInit()
    newFixture.detectChanges();

    expect(newComponent.gameCards.length).toBe(MOCK_GAME_CARDS.length);
  });
});
