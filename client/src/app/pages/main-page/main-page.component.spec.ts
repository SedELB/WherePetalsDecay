import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainPageComponent } from './main-page.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('MainPageComponent', () => {
    let component: MainPageComponent;
    let fixture: ComponentFixture<MainPageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MainPageComponent, RouterTestingModule],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(MainPageComponent);
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
        const compiled = fixture.nativeElement;
        const buttons = compiled.querySelectorAll('.menu-button');
        expect(buttons.length).toBe(3);
    });

    it('should have the "Joindre une partie" button disabled', () => {
        const compiled = fixture.nativeElement;
        const buttons = compiled.querySelectorAll('.menu-button');
        expect(buttons[0].disabled).toBeTrue();
    });
});