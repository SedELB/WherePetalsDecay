import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListContainerComponent } from './list-container.component';

describe('ListContainerComponent', () => {
  let component: ListContainerComponent;
  let fixture: ComponentFixture<ListContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListContainerComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListContainerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
