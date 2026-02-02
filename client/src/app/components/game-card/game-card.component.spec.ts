import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameCard } from '@app/interfaces/game';
import { GameCardComponent } from './game-card.component';

describe('GameCardComponent', () => {
  let component: GameCardComponent;
  let fixture: ComponentFixture<GameCardComponent>;
  const mockGame: GameCard = {
    id: 1,
    image: '/assets/filler.png',
    name: 'Game 1',
    size: '10X10',
    mode: 'Solo',
    date: '2026-01-01',
    visible: true,
    imgDescription: 'test description',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameCardComponent],
    })
      .compileComponents();
    fixture = TestBed.createComponent(GameCardComponent);
    component = fixture.componentInstance;
    component.game = mockGame;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display game info', () => {
    const compiled = fixture.nativeElement;
    const listItems = compiled.querySelectorAll('.card-info li');
    expect(listItems[0].textContent).toContain(mockGame.name);
    expect(listItems[1].textContent).toContain(mockGame.size);
    expect(listItems[2].textContent).toContain(mockGame.mode);
    expect(listItems[3].textContent).toContain(mockGame.date);
  });

  it('should display image correctly', () => {
    const compiled = fixture.nativeElement;
    const img = compiled.querySelector('.thumbnail');
    expect(img.src).toContain(mockGame.image);
    expect(img.alt).toBe(mockGame.name);
  });

  it('should add hidden class when visible is false', () => {
    const testFixture = TestBed.createComponent(GameCardComponent);
    const testComponent = testFixture.componentInstance;

    testComponent.game = { ...mockGame, visible: false };

    testFixture.detectChanges();
    expect(testFixture).toBeDefined();
    const card: HTMLElement = testFixture.nativeElement.querySelector('.gameCard');
    expect(card).toBeTruthy();
    expect(card.classList.contains('hidden')).toBeTrue();
  });

  it('should toggle tooltip on hover events', () => {
    const compiled = fixture.nativeElement;
    const img = compiled.querySelector('.thumbnail');

    component.show = false;
    expect(component.show).toBeFalse();

    img.dispatchEvent(new Event('mouseenter'));
    expect(component.show).toBeTrue();

    img.dispatchEvent(new Event('mouseleave'));
    expect(component.show).toBeFalse();
  });
});
