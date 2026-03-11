import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { ChatComponentComponent } from './chat.component.component';
import { ChatService } from '@app/services/chat/chat.service';

describe('ChatComponentComponent', () => {
  let component: ChatComponentComponent;
  let fixture: ComponentFixture<ChatComponentComponent>;
  let connected$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    connected$ = new BehaviorSubject<boolean>(true);

    await TestBed.configureTestingModule({
      imports: [ChatComponentComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            connected$: connected$.asObservable(),
            roomMessages$: () => new BehaviorSubject([]).asObservable(),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatComponentComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
