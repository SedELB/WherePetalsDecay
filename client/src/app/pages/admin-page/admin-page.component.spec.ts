/**
 * Testing:
 * - Component lifecycle (ngOnInit, ngOnDestroy)
 * - Data fetching, transformation and socket (fetchAllGames, mapping, sorting)
 * - User interactions (navigation, visibility toggle, deletion)
 * - Page rendering (buttons, game cards)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Game } from '@app/interfaces/game';
import { AdminGameService } from '@app/services/admin-game/admin-game.service';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameMode } from '@common/enums';
import { BehaviorSubject, of } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';

describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;
  let communicationService: jasmine.SpyObj<CommunicationService>;
  let adminGameService: jasmine.SpyObj<AdminGameService>;
  let router: Router;
  let gamesSubject: BehaviorSubject<Game[]>;

  // Mock three games for test purposes
  const MOCK_GAME_CARDS: Game[] = [
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
      isVisible: true, // Make this one visible
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
      isVisible: true, // Make this one visible
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
      isVisible: false, // Make this one not visible
    },
  ];

  beforeEach(async () => {
    // Mock BehaviorSubject to simulate stream and emit event
    gamesSubject = new BehaviorSubject<Game[]>(MOCK_GAME_CARDS);

    // Mock communicationService, allow us to actually call methods
    communicationService = jasmine.createSpyObj('CommunicationService', [
      'deleteGame',
      'updateVisiblity',
    ]);

    // AdminGameService owns the game list
    adminGameService = jasmine.createSpyObj(
      'AdminGameService',
      ['fetchAllGames', 'setGames'],
      { games$: gamesSubject.asObservable() },
    );

    // Make fetchAllGames return our mock data
    adminGameService.fetchAllGames.and.returnValue(of(MOCK_GAME_CARDS));

    // Configure the testing module
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, RouterTestingModule],
      providers: [
        { provide: CommunicationService, useValue: communicationService },
        { provide: AdminGameService, useValue: adminGameService },
      ],
    }).compileComponents();

    // Create the component instances
    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // Fetch games on component construction
  it('should call fetchAllGames on ngOnInit', () => {
    fixture.detectChanges();
    expect(adminGameService.fetchAllGames).toHaveBeenCalled();
  });

  // Successful call of fetchAllGames
  it('should call setGames with fetched games on successful fetch', () => {
    fixture.detectChanges();
    expect(adminGameService.setGames).toHaveBeenCalledWith(MOCK_GAME_CARDS);
  });

  // Testing the subscription to games$, websocket
  it('should subscribe to games$ and fill gameCards array', () => {
    fixture.detectChanges();
    expect(component.games.length).toBe(MOCK_GAME_CARDS.length);
    expect(component.gameCards.length).toBe(MOCK_GAME_CARDS.length);
  });

  // Making sure we can convert Game object to GameCard
  it('should convert Game objects to GameCard objects', () => {
    fixture.detectChanges();
    const firstGameCard = component.gameCards[0];

    expect(firstGameCard.name).toBe('Test1');
    expect(firstGameCard.description).toBe('test1description');
    expect(firstGameCard.size).toEqual({ rows: 20, cols: 20 });
    expect(firstGameCard.gameMode).toBe(GameMode.Classic);
    expect(firstGameCard.thumbnail).toBe('thumb');
    expect(firstGameCard.createdAt).toEqual(new Date('2024-01-15'));
    expect(firstGameCard.updatedAt).toEqual(new Date('2024-01-15'));
    expect(firstGameCard.isVisible).toBe(true);
  });

  // Make sure the ordering that appears is right
  it('should sort gameCards by createdAt in ascending order', () => {
    fixture.detectChanges();

    expect(component.gameCards[0].name).toBe('Test1');
    expect(component.gameCards[1].name).toBe('Test2');
    expect(component.gameCards[2].name).toBe('Test3');
  });

  // Handling possible backend type missmatch
  it('should handle createdAt as string when sorting', () => {
    const gamesWithStringDates: Game[] = [
      { ...MOCK_GAME_CARDS[0], createdAt: '2024-01-01' as unknown as Date },
      { ...MOCK_GAME_CARDS[1], createdAt: '2024-02-01' as unknown as Date },
    ];

    gamesSubject.next(gamesWithStringDates);
    fixture.detectChanges();

    expect(component.gameCards[0].name).toBe('Test1');
    expect(component.gameCards[1].name).toBe('Test2');
  });

  // Stop the tracking game$ when the component is destroyed
  it('should unsubscribe from games$ on ngOnDestroy', () => {
    fixture.detectChanges();

    const subscription = component['subscription'];
    if (subscription) {
      spyOn(subscription, 'unsubscribe');
    }

    component.ngOnDestroy();

    if (subscription) {
      expect(subscription.unsubscribe).toHaveBeenCalled();
    }
  });

  // Testing for possible undefined games$ subscription
  it('should not throw error in ngOnDestroy if subscription is not defined', () => {
    component['subscription'] = undefined;
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  // Navigate to editor page with a game object
  it('should navigate to editor with a game and a mode', () => {
    fixture.detectChanges();
    spyOn(router, 'navigate');

    component.navigateToGameEditor('Test1');

    expect(router.navigate).toHaveBeenCalledWith(
      ['/editor'],
      { state: { game: MOCK_GAME_CARDS[0], mode: 'edit' } },
    );
  });

  // Naviagte with a fake game
  it('should navigate with undefined game when game name does not exist', () => {
    fixture.detectChanges();
    spyOn(router, 'navigate');

    component.navigateToGameEditor('Random');

    // Should still navigate but with undefined game
    // The game will not exist when saving so it will be created
    // The admin page is not responsible to handle possible errors we true or fake game
    // we leave this for the editor page
    expect(router.navigate).toHaveBeenCalledWith(
      ['/editor'],
      { state: { game: undefined, mode: 'edit' } },
    );
  });

  // Testing isVisible
  it('should call updateVisiblity with correct game', () => {
    fixture.detectChanges();
    communicationService.updateVisiblity.and.returnValue(of(void 0));

    component.changeVisibility('Test1');

    expect(communicationService.updateVisiblity).toHaveBeenCalledWith(MOCK_GAME_CARDS[0]);
  });

  // Impossible to updateVisibility on a non existing game with no errors
  it('should not call updateVisiblity when game does not exist', () => {
    fixture.detectChanges();
    communicationService.updateVisiblity.and.returnValue(of(void 0));

    component.changeVisibility('Random');

    expect(communicationService.updateVisiblity).not.toHaveBeenCalled();
  });

  // Testing deleting a game
  it('should call deleteGame with correct game id', () => {
    fixture.detectChanges();
    communicationService.deleteGame.and.returnValue(of(void 0));

    component.removeGame('Test1');

    expect(communicationService.deleteGame).toHaveBeenCalledWith('1');
  });

  // Can't delete non existing game with no errors
  it('should not call deleteGame when game does not exist', () => {
    fixture.detectChanges();
    communicationService.deleteGame.and.returnValue(of(void 0));

    component.removeGame('Random');

    expect(communicationService.deleteGame).not.toHaveBeenCalled();
  });

  // Making sure the return button exist
  it('should render return button on the page', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll<HTMLElement>('app-button');
    const returnButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes('Retour'),
    );

    expect(returnButton).toBeTruthy();
  });

  // Making sure the add game button exist
  it('should render add button on the page', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const addButton = compiled.querySelector('.add-button');

    expect(addButton).toBeTruthy();
  });

  // Verify all games appear
  it('should render all games as app-game-card components', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const gameCardElements = compiled.querySelectorAll('app-game-card');

    expect(gameCardElements.length).toBe(MOCK_GAME_CARDS.length);
  });

  // Each game-card should have three buttons (Edit, Hide/Show, Delete)
  it('should render three action buttons for each game card', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const gameCards = compiled.querySelectorAll<HTMLElement>('app-game-card');

    const EXPECTED_BUTTON_COUNT = 3;
    gameCards.forEach((card) => {
      const buttonsInCard = card.querySelectorAll('app-button');
      expect(buttonsInCard.length).toBe(EXPECTED_BUTTON_COUNT);
    });
  });

  // Visible games show hide button
  it('should display "Cacher" when game is visible', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const gameCards = compiled.querySelectorAll<HTMLElement>('app-game-card');

    const test1Card = gameCards[0]; // isVisible==True
    const buttons = test1Card.querySelectorAll('app-button');
    const visibilityButton = buttons[1];

    expect(visibilityButton.textContent).toContain('Cacher');
  });

  // Hidden games should have a show button
  it('should display "Afficher" when game is not visible', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const gameCards = compiled.querySelectorAll<HTMLElement>('app-game-card');

    const echecsCard = gameCards[2]; // isVisible==False
    const buttons = echecsCard.querySelectorAll('app-button');
    const visibilityButton = buttons[1];

    expect(visibilityButton.textContent).toContain('Afficher');
  });

  // The visibale game cards should change when one game is shown or hidden
  it('should update the page when gameCards array changes', () => {
    fixture.detectChanges();

    const reducedGames = [MOCK_GAME_CARDS[0]];
    gamesSubject.next(reducedGames);
    fixture.detectChanges();

    const gameCardElements = fixture.nativeElement.querySelectorAll('app-game-card');
    expect(gameCardElements.length).toBe(1);
  });

  // Should work when no game is available
  it('should handle empty games array', () => {
    gamesSubject.next([]);
    fixture.detectChanges();

    expect(component.games.length).toBe(0);
    expect(component.gameCards.length).toBe(0);

    const gameCardElements = fixture.nativeElement.querySelectorAll('app-game-card');
    expect(gameCardElements.length).toBe(0);
  });

  // React when new value comes from the socket
  it('should update when games$ emits new values', () => {
    const INITIAL_GAME_COUNT = 3;
    const UPDATED_GAME_COUNT = 2;
    fixture.detectChanges();

    expect(component.games.length).toBe(INITIAL_GAME_COUNT);

    const newGames = [MOCK_GAME_CARDS[0], MOCK_GAME_CARDS[1]];
    gamesSubject.next(newGames);

    expect(component.games.length).toBe(UPDATED_GAME_COUNT);
    expect(component.gameCards.length).toBe(UPDATED_GAME_COUNT);
  });

});
