import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePageComponent } from './homepage.component';

describe('HomePageComponent', () => {
    let component: HomePageComponent;
    let fixture: ComponentFixture<HomePageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HomePageComponent],
            providers: [provideRouter([])],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(HomePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have a game title', () => {
        expect(component.gameTitle).toBeDefined();
    });

    it('should have a team number', () => {
        expect(component.teamNumber).toBeDefined();
    });

    it('should have team members', () => {
        expect(component.teamMembers).toBeDefined();
        expect(component.teamMembers.length).toBeGreaterThan(0);
    });

    it('should display the game title in the template', () => {
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.game-title').textContent).toContain(component.gameTitle);
    });

    it('should display team information in the template', () => {
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.team-info')).toBeTruthy();
    });

    it('should have three menu buttons', () => {
        const expectedButtonCount = 3;
        const compiled = fixture.nativeElement;
        const buttons = compiled.querySelectorAll('app-button');
        expect(buttons.length).toBe(expectedButtonCount);
    });
});