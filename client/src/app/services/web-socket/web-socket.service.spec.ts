import { TestBed } from '@angular/core/testing';
import { WebSocketService } from './web-socket.service';

describe('WebSocketService', () => {
    let service: WebSocketService;
    let mockSocket: {
        connected: boolean;
        disconnect: jasmine.Spy;
        on: jasmine.Spy;
        emit: jasmine.Spy;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [WebSocketService],
        });
        service = TestBed.inject(WebSocketService);

        mockSocket = {
            connected: false,
            disconnect: jasmine.createSpy('disconnect'),
            on: jasmine.createSpy('on'),
            emit: jasmine.createSpy('emit'),
        };
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('connect', () => {
        it('should create a socket when not connected', () => {
            expect(service['socket']).toBeNull();
            service.connect();
            expect(service['socket']).not.toBeNull();
        });

        it('should not reconnect if already connected', () => {
            service['socket'] = mockSocket as never;
            mockSocket.connected = true;
            service.connect();
            expect(service['socket']).toBe(mockSocket as never);
        });
    });

    describe('disconnect', () => {
        it('should disconnect and nullify socket', () => {
            service['socket'] = mockSocket as never;
            service.disconnect();
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(service['socket']).toBeNull();
        });

        it('should do nothing if no socket exists', () => {
            service.disconnect();
            expect(mockSocket.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('on', () => {
        it('should register an event listener on the socket', () => {
            service['socket'] = mockSocket as never;
            const callback = jasmine.createSpy('callback');
            service.on('testEvent', callback);
            expect(mockSocket.on).toHaveBeenCalledWith('testEvent', jasmine.any(Function));
        });

        it('should do nothing if socket is null', () => {
            const callback = jasmine.createSpy('callback');
            service.on('testEvent', callback);
            expect(mockSocket.on).not.toHaveBeenCalled();
        });
    });

    describe('emit', () => {
        it('should emit an event with data', () => {
            service['socket'] = mockSocket as never;
            service.emit('testEvent', { key: 'value' });
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', { key: 'value' });
        });

        it('should emit an event without data', () => {
            service['socket'] = mockSocket as never;
            service.emit('testEvent');
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', undefined);
        });

        it('should do nothing if socket is null', () => {
            service.emit('testEvent', { key: 'value' });
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('isConnected', () => {
        it('should return false when no socket exists', () => {
            expect(service.isConnected).toBe(false);
        });

        it('should return false when socket is not connected', () => {
            service['socket'] = mockSocket as never;
            mockSocket.connected = false;
            expect(service.isConnected).toBe(false);
        });

        it('should return true when socket is connected', () => {
            service['socket'] = mockSocket as never;
            mockSocket.connected = true;
            expect(service.isConnected).toBe(true);
        });
    });

    describe('ngOnDestroy', () => {
        it('should disconnect on destroy', () => {
            service['socket'] = mockSocket as never;
            service.ngOnDestroy();
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(service['socket']).toBeNull();
        });
    });
});