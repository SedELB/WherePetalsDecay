import { TestBed } from '@angular/core/testing';
import { JournalService } from './journal.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';

describe('JournalService', () => {
    let service: JournalService;
    let webSocketSpy: jasmine.SpyObj<WebSocketService>;

    beforeEach(() => {
        webSocketSpy = jasmine.createSpyObj('WebSocketService', ['onNamespace']);
        
        TestBed.configureTestingModule({
            providers: [{ provide: WebSocketService, useValue: webSocketSpy }],
        });
        service = TestBed.inject(JournalService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
