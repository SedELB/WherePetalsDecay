/**
 * Testing:
 * - Socket connection management (connect, disconnect)
 * - Event registration and emission
 * - Namespace-based socket organization
 * - Lifecycle cleanup (ngOnDestroy)
 */

import { TestBed } from '@angular/core/testing';
import { SocketNamespace } from '@common/enums';
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

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test constructor initializes Admin and Games namespaces
    it('should connect to Admin and Games namespaces on construction', () => {
        expect(service['sockets'].has(SocketNamespace.Admin)).toBe(true);
        expect(service['sockets'].has(SocketNamespace.Games)).toBe(true);
    });

    // Test connectNamespace creates socket
    it('should create a socket for a new namespace', () => {
        const namespace = '/test-namespace';
        service.connectNamespace(namespace);
        expect(service.isConnectedNamespace(namespace) || service['sockets'].has(namespace)).toBeTruthy();
    });

    // Reconnecting to an existing namespace
    it('should not reconnect if namespace already exists', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        const sizeBefore = service['sockets'].size;
        service.connectNamespace(namespace);
        expect(service['sockets'].size).toBe(sizeBefore);
    });

    // Test disconnectNamespace removes socket
    it('should disconnect and remove socket from map', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        service.disconnectNamespace(namespace);
        expect(mockSocket.disconnect).toHaveBeenCalled();
        expect(service['sockets'].has(namespace)).toBe(false);
    });

    // Disconnecting non-existent namespace
    it('should do nothing if namespace does not exist on disconnect', () => {
        const namespace = '/nonexistent';
        service.disconnectNamespace(namespace);
        expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    // Test onNamespace registers event listener
    it('should register an event listener on the namespace socket', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        const callback = jasmine.createSpy('callback');
        service.onNamespace(namespace, 'testEvent', callback);
        expect(mockSocket.on).toHaveBeenCalledWith('testEvent', jasmine.any(Function));
    });

    // Event listener on non-existent namespace
    it('should do nothing if namespace socket does not exist for onNamespace', () => {
        const callback = jasmine.createSpy('callback');
        service.onNamespace('/nonexistent', 'testEvent', callback);
        expect(mockSocket.on).not.toHaveBeenCalled();
    });

    // Test emitNamespace with data
    it('should emit an event with data for namespace socket', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        service.emitNamespace(namespace, 'testEvent', { key: 'value' });
        expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', { key: 'value' });
    });

    // Test emitNamespace without data
    it('should emit an event without data', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        service.emitNamespace(namespace, 'testEvent');
        expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', undefined);
    });

    // Emit on non-existent namespace
    it('should do nothing if namespace socket does not exist for emit', () => {
        service.emitNamespace('/nonexistent', 'testEvent', { key: 'value' });
        expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    // Test isConnectedNamespace returns false for non-existent
    it('should return false when namespace does not exist', () => {
        expect(service.isConnectedNamespace('/nonexistent')).toBe(false);
    });

    // Test isConnectedNamespace returns false when disconnected
    it('should return false when socket is not connected', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        mockSocket.connected = false;
        expect(service.isConnectedNamespace(namespace)).toBe(false);
    });

    // Test isConnectedNamespace returns true when connected
    it('should return true when socket is connected', () => {
        const namespace = '/test-namespace';
        service['sockets'].set(namespace, mockSocket as never);
        mockSocket.connected = true;
        expect(service.isConnectedNamespace(namespace)).toBe(true);
    });

    // Test ngOnDestroy disconnects all sockets
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

    // ngOnDestroy with no sockets
    it('should handle ngOnDestroy with empty socket map', () => {
        service['sockets'].clear();
        expect(() => service.ngOnDestroy()).not.toThrow();
        expect(service['sockets'].size).toBe(0);
    });
});
