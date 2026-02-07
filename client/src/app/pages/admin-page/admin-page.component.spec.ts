import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication.service';
import { of } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';

const MOCK_GAMES: Game[] = [
  {
    _id: '1',
    name: 'Game 1',
    description: 'Description 1',
    size: { rows: 10, cols: 10 },
    gameMode: 'classic',
    thumbnail: '/assets/thumb1.png',
    maxPlayers: 4,
    grid: [[]],
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: '2',
    name: 'Game 2',
    description: 'Description 2',
    size: { rows: 20, cols: 20 },
    gameMode: 'ctf',
    thumbnail: '/assets/thumb2.png',
    maxPlayers: 6,
    grid: [[]],
    isVisible: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;
  let communicationServiceSpy: jasmine.SpyObj<CommunicationService>;

  beforeEach(async () => {
    communicationServiceSpy = jasmine.createSpyObj('CommunicationService', ['getAllGames']);
    communicationServiceSpy.getAllGames.and.returnValue(of(MOCK_GAMES));

    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, RouterTestingModule],
      providers: [
        { provide: CommunicationService, useValue: communicationServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have games array', () => {
    expect(component.games.length).toBeGreaterThan(0);
  });

  it('should render all games', () => {
    const compiled = fixture.nativeElement;
    const gameCards = compiled.querySelectorAll('app-game-card');
    expect(gameCards.length).toBe(component.games.length);
  });

  it('should remove game', () => {
    const initialLength = component.games.length;
    const gameId = component.games[0].id;

    component.removeGame(gameId);

    expect(component.games.length).toBe(initialLength - 1);
    expect(component.games.find(g => g.id === gameId)).toBeUndefined();
  });

  it('should toggle visibility', () => {
    const game = component.games[0];
    const wasVisible = game.visible;

    component.changeVisibility(game.id);

    expect(game.visible).toBe(!wasVisible);
  });

  it('should update DOM when game removed', () => {
    const gameId = component.games[0].id;
    const initialLength = component.games.length;

    component.removeGame(gameId);
    fixture.detectChanges();

    const gameCards = fixture.nativeElement.querySelectorAll('app-game-card');
    expect(gameCards.length).toBe(initialLength - 1);
  });

  it('should have return and add buttons', () => {
    const compiled = fixture.nativeElement;
    const buttons = compiled.querySelectorAll('app-button');
    const addButton = compiled.querySelector('.add-button');

    expect(buttons.length).toBeGreaterThan(0);
    expect(addButton).toBeTruthy();
  });
});
