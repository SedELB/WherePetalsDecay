import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MapSetupPageComponent } from './map-setup-page.component';

describe('MapSetupPageComponent', () => {
  let component: MapSetupPageComponent;
  let fixture: ComponentFixture<MapSetupPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapSetupPageComponent, RouterTestingModule]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MapSetupPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
