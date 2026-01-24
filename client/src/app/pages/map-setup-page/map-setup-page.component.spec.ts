import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapSetupPageComponent } from './map-setup-page.component';

describe('MapSetupPageComponent', () => {
  let component: MapSetupPageComponent;
  let fixture: ComponentFixture<MapSetupPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapSetupPageComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MapSetupPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
