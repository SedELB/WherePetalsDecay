import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { ChatComponent } from './chat.component';
import { ChatService } from '@app/services/chat/chat.service';

describe('ChatComponent', () => {
    let component: ChatComponent;
    let fixture: ComponentFixture<ChatComponent>;
    let connected$: BehaviorSubject<boolean>;

    beforeEach(async () => {
        connected$ = new BehaviorSubject<boolean>(true);

        await TestBed.configureTestingModule({
            imports: [ChatComponent],
            providers: [
                {
                    provide: ChatService,
                    useValue: {
                        connected$: connected$.asObservable(),
                        roomMessages$: () => new BehaviorSubject([]).asObservable(),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
