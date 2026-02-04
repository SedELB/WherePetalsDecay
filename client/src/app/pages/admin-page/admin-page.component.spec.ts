import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AdminPageComponent } from './admin-page.component';

describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have games array', () => {
    expect(component.gameCards.length).toBeGreaterThan(0);
  });

  it('should render all games', () => {
    const compiled = fixture.nativeElement;
    const gameCards = compiled.querySelectorAll('app-game-card');
    expect(gameCards.length).toBe(component.gameCards.length);
  });

  it('should remove game', () => {
    const initialLength = component.gameCards.length;
    const gameName = component.gameCards[0].name;

    component.removeGame(gameName);

    expect(component.gameCards.length).toBe(initialLength - 1);
    expect(component.gameCards.find(g => g.name === gameName)).toBeUndefined();
  });

  it('should toggle visibility', () => {
    const game = component.gameCards[0];
    const wasVisible = game.isVisible;

    component.changeVisibility(game.name);

    expect(game.isVisible).toBe(!wasVisible);
  });

  it('should update DOM when game removed', () => {
    const gamename = component.gameCards[0].name;
    const initialLength = component.gameCards.length;

    component.removeGame(gamename);
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
