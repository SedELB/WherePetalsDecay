import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { WaitingRoomService } from './waiting-room.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';

describe('WaitingRoomService', () => {
    let service: WaitingRoomService;
    let webSocketServiceSpy: jasmine.SpyObj<WebSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        webSocketServiceSpy = jasmine.createSpyObj('WebSocketService', [
            'connectNamespace',
            'disconnectNamespace',
            'onNamespace',
            'emitNamespace',
        ]);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        TestBed.configureTestingModule({
            providers: [
                WaitingRoomService,
                { provide: WebSocketService, useValue: webSocketServiceSpy },
                { provide: Router, useValue: routerSpy },
            ],
        });

        service = TestBed.inject(WaitingRoomService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should connect to namespace', () => {
        service.connect();
        expect(webSocketServiceSpy.connectNamespace).toHaveBeenCalledWith('/waiting-room');
    });

    it('should disconnect from namespace', () => {
        service.connect();
        service.disconnect();
        expect(webSocketServiceSpy.disconnectNamespace).toHaveBeenCalledWith('/waiting-room');
    });
});
