import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMode } from '@common/enums';
import { Lobby } from '@common/lobby';
import { LobbyCardComponent } from './lobby-card.component';

describe('LobbyCardComponent', () => {
  let component: LobbyCardComponent;
  let fixture: ComponentFixture<LobbyCardComponent>;

  const MOCK_LOBBY: Lobby = {
    lobbyId: 'ABCDE',
    gameId: 'game-1',
    hostSocketId: 'socket-1',
    playerCount: 1,
    isLocked: false,
    pendingAvatars: {},
    players: [],
    game: {
      _id: 'game-1',
      name: 'Test Game',
      description: 'A test game',
      size: { rows: 10, cols: 10 },
      gameMode: GameMode.Classic,
      thumbnail: 'thumb.png',
      maxPlayers: 4,
      grid: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isVisible: true,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LobbyCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyCardComponent);
    component = fixture.componentInstance;
    component.lobby = MOCK_LOBBY;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
