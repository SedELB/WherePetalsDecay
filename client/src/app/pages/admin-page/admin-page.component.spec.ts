import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AdminPageComponent } from './admin-page.component';

describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, RouterTestingModule],
    })
      .compileComponents();

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
