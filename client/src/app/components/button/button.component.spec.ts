import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
    let component: ButtonComponent;
    let fixture: ComponentFixture<ButtonComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonComponent],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have default values', () => {
        expect(component.color).toBe('white');
        expect(component.backgroundColor).toBe(null);
        expect(component.disabled).toBe(false);
        expect(component.selected).toBe(false);
    });

    it('should return background image when backgroundPath is set', () => {
        component.backgroundPath = 'test/path.png';
        expect(component.backgroundImage).toBe('url(test/path.png)');
    });

    it('should return null when backgroundPath is not set', () => {
        expect(component.backgroundImage).toBeNull();
    });
});