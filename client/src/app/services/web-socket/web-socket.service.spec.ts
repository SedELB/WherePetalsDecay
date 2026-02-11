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

    describe('connectNamespace', () => {
        it('should create a socket for a new namespace', () => {
            const namespace = '/test-namespace';
            service.connectNamespace(namespace);
            expect(service.isConnectedNamespace(namespace) || service['sockets'].has(namespace)).toBeTruthy();
        });

        it('should not reconnect if namespace already exists', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            const sizeBefore = service['sockets'].size;
            service.connectNamespace(namespace);
            expect(service['sockets'].size).toBe(sizeBefore);
        });
    });

    describe('disconnectNamespace', () => {
        it('should disconnect and remove socket from map', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            service.disconnectNamespace(namespace);
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(service['sockets'].has(namespace)).toBe(false);
        });

        it('should do nothing if namespace does not exist', () => {
            const namespace = '/nonexistent';
            service.disconnectNamespace(namespace);
            expect(mockSocket.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('onNamespace', () => {
        it('should register an event listener on the namespace socket', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            const callback = jasmine.createSpy('callback');
            service.onNamespace(namespace, 'testEvent', callback);
            expect(mockSocket.on).toHaveBeenCalledWith('testEvent', jasmine.any(Function));
        });

        it('should do nothing if namespace socket does not exist', () => {
            const callback = jasmine.createSpy('callback');
            service.onNamespace('/nonexistent', 'testEvent', callback);
            expect(mockSocket.on).not.toHaveBeenCalled();
        });
    });

    describe('emitNamespace', () => {
        it('should emit an event with data on namespace socket', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            service.emitNamespace(namespace, 'testEvent', { key: 'value' });
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', { key: 'value' });
        });

        it('should emit an event without data', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            service.emitNamespace(namespace, 'testEvent');
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', undefined);
        });

        it('should do nothing if namespace socket does not exist', () => {
            service.emitNamespace('/nonexistent', 'testEvent', { key: 'value' });
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('isConnectedNamespace', () => {
        it('should return false when namespace does not exist', () => {
            expect(service.isConnectedNamespace('/nonexistent')).toBe(false);
        });

        it('should return false when socket is not connected', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            mockSocket.connected = false;
            expect(service.isConnectedNamespace(namespace)).toBe(false);
        });

        it('should return true when socket is connected', () => {
            const namespace = '/test-namespace';
            service['sockets'].set(namespace, mockSocket as never);
            mockSocket.connected = true;
            expect(service.isConnectedNamespace(namespace)).toBe(true);
        });
    });

    describe('ngOnDestroy', () => {
        it('should disconnect all sockets on destroy', () => {
            const namespace1 = '/test1';
            const namespace2 = '/test2';
            const mockSocket2 = {
                connected: false,
                disconnect: jasmine.createSpy('disconnect'),
                on: jasmine.createSpy('on'),
                emit: jasmine.createSpy('emit'),
            };
            service['sockets'].set(namespace1, mockSocket as never);
            service['sockets'].set(namespace2, mockSocket2 as never);
            service.ngOnDestroy();
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(mockSocket2.disconnect).toHaveBeenCalled();
            expect(service['sockets'].size).toBe(0);
        });
    });
});