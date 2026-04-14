import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';

describe('ChatService', () => {
    let service: ChatService;
    let webSocketSpy: jasmine.SpyObj<WebSocketService>;

    beforeEach(() => {
        webSocketSpy = jasmine.createSpyObj('WebSocketService', ['onNamespace']);
        
        TestBed.configureTestingModule({
            providers: [{ provide: WebSocketService, useValue: webSocketSpy }],
        });
        service = TestBed.inject(ChatService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
