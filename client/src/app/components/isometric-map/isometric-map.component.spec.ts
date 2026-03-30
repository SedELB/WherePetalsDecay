import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IsometricMapComponent } from './isometric-map.component';

describe('IsometricMapComponent', () => {
  let component: IsometricMapComponent;
  let fixture: ComponentFixture<IsometricMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IsometricMapComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(IsometricMapComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
