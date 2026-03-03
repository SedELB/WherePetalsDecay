import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LobbyCardComponent } from './lobby-card.component';

describe('LobbyCardComponent', () => {
  let component: LobbyCardComponent;
  let fixture: ComponentFixture<LobbyCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LobbyCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LobbyCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
