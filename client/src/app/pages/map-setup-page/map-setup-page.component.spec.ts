import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MapSetupPageComponent } from './map-setup-page.component';

describe('MapSetupPageComponent', () => {
    let component: MapSetupPageComponent;
    let fixture: ComponentFixture<MapSetupPageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MapSetupPageComponent],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(MapSetupPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});