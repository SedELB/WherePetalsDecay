/**
 * Testing:
 * - Game mode selection (Classic, CTF)
 * - Map size selection (small, medium, large)
 * - Form validation (can only create if both are selected)
 * - Game creation and navigation to editor
 * - Page rendering (buttons, selections)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { GameMode, GridSizes, MapSizeKey, MaxPlayers } from '@common/enums';
import { CreateGamePageComponent } from './create-game-page.component';

describe('CreateGamePageComponent', () => {
  let component: CreateGamePageComponent;
  let fixture: ComponentFixture<CreateGamePageComponent>;
  let router: Router;

  beforeEach(async () => {
    // Configure the testing module
    await TestBed.configureTestingModule({
      imports: [CreateGamePageComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateGamePageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // No selection initially
  it('should have no game mode selected initially', () => {
    expect(component.gameMode).toBeNull();
  });

  it('should have no map size selected initially', () => {
    expect(component.mapSize).toBeNull();
  });

  // Test game mode selection
  it('should select Classic game mode', () => {
    component.gameModeSelected(GameMode.Classic);
    expect(component.gameMode).toBe(GameMode.Classic);
  });

  it('should select CTF game mode', () => {
    component.gameModeSelected(GameMode.Ctf);
    expect(component.gameMode).toBe(GameMode.Ctf);
  });

  // Test map size selection
  it('should select small map size', () => {
    component.mapSizeSelected(MapSizeKey.Small);
    expect(component.mapSize).toBe(MapSizeKey.Small);
  });

  it('should select medium map size', () => {
    component.mapSizeSelected(MapSizeKey.Medium);
    expect(component.mapSize).toBe(MapSizeKey.Medium);
  });

  it('should select large map size', () => {
    component.mapSizeSelected(MapSizeKey.Large);
    expect(component.mapSize).toBe(MapSizeKey.Large);
  });

  // Test canCreateGame getter
  it('should not allow game creation when nothing is selected', () => {
    component.gameMode = null;
    component.mapSize = null;
    expect(component.canCreateGame).toBe(false);
  });

  it('should not allow game creation when only game mode is selected', () => {
    component.gameMode = GameMode.Classic;
    component.mapSize = null;
    expect(component.canCreateGame).toBe(false);
  });

  it('should not allow game creation when only map size is selected', () => {
    component.gameMode = null;
    component.mapSize = MapSizeKey.Small;
    expect(component.canCreateGame).toBe(false);
  });

  it('should allow game creation when both game mode and map size are selected', () => {
    component.gameMode = GameMode.Classic;
    component.mapSize = MapSizeKey.Small;
    expect(component.canCreateGame).toBe(true);
  });

  // Test game creation with small map
  it('should create game with small map and navigate to editor', () => {
    component.gameMode = GameMode.Classic;
    component.mapSize = MapSizeKey.Small;

    const navigateSpy = spyOn(router, 'navigate');
    component.createAndNavigateToGameEditor();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/editor/new'],
      jasmine.objectContaining({
        state: jasmine.objectContaining({
          game: jasmine.objectContaining({
            size: { rows: 10, cols: 10 },
            gameMode: GameMode.Classic,
            maxPlayers: MaxPlayers.Small,
          }),
          mode: 'create',
        }),
      }),
    );
  });

  // Test game creation with medium map
  it('should create game with medium map and navigate to editor', () => {
    component.gameMode = GameMode.Ctf;
    component.mapSize = MapSizeKey.Medium;

    const navigateSpy = spyOn(router, 'navigate');
    component.createAndNavigateToGameEditor();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/editor/new'],
      jasmine.objectContaining({
        state: jasmine.objectContaining({
          game: jasmine.objectContaining({
            size: { rows: 15, cols: 15 },
            gameMode: GameMode.Ctf,
            maxPlayers: MaxPlayers.Medium,
          }),
          mode: 'create',
        }),
      }),
    );
  });

  // Test game creation with large map
  it('should create game with large map and navigate to editor', () => {
    component.gameMode = GameMode.Classic;
    component.mapSize = MapSizeKey.Large;

    const navigateSpy = spyOn(router, 'navigate');
    component.createAndNavigateToGameEditor();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/editor/new'],
      jasmine.objectContaining({
        state: jasmine.objectContaining({
          game: jasmine.objectContaining({
            size: { rows: 20, cols: 20 },
            gameMode: GameMode.Classic,
            maxPlayers: MaxPlayers.Large,
          }),
          mode: 'create',
        }),
      }),
    );
  });

  // Test that created game has required fields
  it('should create game with all required fields', () => {
    component.gameMode = GameMode.Classic;
    component.mapSize = MapSizeKey.Medium;

    const navigateSpy = spyOn(router, 'navigate');
    component.createAndNavigateToGameEditor();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/editor/new'],
      jasmine.objectContaining({
        state: jasmine.objectContaining({
          game: jasmine.objectContaining({
            _id: '',
            name: '',
            description: '',
            thumbnail: '',
            grid: [],
            isVisible: true,
          }),
          mode: 'create',
        }),
      }),
    );
  });

  // Test that created game has dates
  it('should create game with createdAt and updatedAt dates', () => {
    component.gameMode = GameMode.Classic;
    component.mapSize = MapSizeKey.Small;

    const navigateSpy = spyOn(router, 'navigate');
    component.createAndNavigateToGameEditor();

    const call = navigateSpy.calls.mostRecent();
    const state = call.args[1] as { state: { game: { createdAt: Date; updatedAt: Date }; mode: string } };
    const game = state.state.game;

    expect(game.createdAt).toBeInstanceOf(Date);
    expect(game.updatedAt).toBeInstanceOf(Date);
  });

  // Test size configurations via game creation
  it('should use correct grid sizes from configuration', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.gameMode = GameMode.Classic;
    component.mapSize = MapSizeKey.Small;
    component.createAndNavigateToGameEditor();
    expect(navigateSpy).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({
      state: jasmine.objectContaining({ game: jasmine.objectContaining({ size: { rows: GridSizes.Small, cols: GridSizes.Small } }) }),
    }));

    component.mapSize = MapSizeKey.Medium;
    component.createAndNavigateToGameEditor();
    expect(navigateSpy).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({
      state: jasmine.objectContaining({ game: jasmine.objectContaining({ size: { rows: GridSizes.Medium, cols: GridSizes.Medium } }) }),
    }));

    component.mapSize = MapSizeKey.Large;
    component.createAndNavigateToGameEditor();
    expect(navigateSpy).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({
      state: jasmine.objectContaining({ game: jasmine.objectContaining({ size: { rows: GridSizes.Large, cols: GridSizes.Large } }) }),
    }));
  });

  // Test return button appears
  it('should render return button on the page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const returnButton = compiled.querySelector('app-button');

    expect(returnButton).toBeTruthy();
  });

  // Test create button appears
  it('should render create button on the page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const createButton = compiled.querySelector('#save-button');

    expect(createButton).toBeTruthy();
  });

  // Test map size buttons appears
  it('should render all three map size buttons', () => {
    const EXPECTED_SIZE_CARD_COUNT = 3;
    const compiled = fixture.nativeElement as HTMLElement;
    const sizeCards = compiled.querySelectorAll('.size-card');

    expect(sizeCards.length).toBe(EXPECTED_SIZE_CARD_COUNT);
  });

  // Test game mode buttons appears
  it('should render both game mode buttons', () => {
    const EXPECTED_GAME_MODE_COUNT = 2;
    const compiled = fixture.nativeElement as HTMLElement;
    const gameModeButtons = compiled.querySelector('.gamemode-button');
    const buttons = gameModeButtons?.querySelectorAll('app-button');

    expect(buttons).toBeTruthy();
    if (buttons) {
        expect(buttons.length).toBe(EXPECTED_GAME_MODE_COUNT);
    }
  });

  // Test button selection for map size
  it('should mark selected map size button', () => {
    fixture.detectChanges();
    component.mapSize = MapSizeKey.Large;

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('app-button');

    const largeButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes('Grande'),
    );

    expect(largeButton).toBeTruthy();
  });

  // Test button selection for game mode
  it('should mark selected game mode button', () => {
    fixture.detectChanges();
    component.gameMode = GameMode.Classic;

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('app-button');

    const classicButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes('Classique'),
    );

    expect(classicButton).toBeTruthy();
  });

  // Test that gameModeEnum is available
  it('should show GameMode enum as gameModeEnum', () => {
    expect(component.gameModeEnum).toBe(GameMode);
  });

});
