/**
 * Test suite for the WebSocketService.
 * This service acts as a thin, foundational wrapper around the socket.io client, routing connections into discrete namespaces (Admin, Games, Join).
 * The tests simulate the internal socket map to verify that connections are instantiated only when required, and properly terminated to prevent resource exhaustion.
 * It also thoroughly validates the lifecycle hooks to ensure complete teardowns of all active sockets when the service is destroyed.
 */

import { TestBed } from '@angular/core/testing';
import { SocketNamespace } from '@common/enums';
import { WebSocketService } from './web-socket.service';

describe('WebSocketService', () => {
    let service: WebSocketService;
    let mockSocket: { connected: boolean; disconnect: jasmine.Spy; on: jasmine.Spy; emit: jasmine.Spy };

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [WebSocketService] });
        service = TestBed.inject(WebSocketService);
        mockSocket = { connected: false, disconnect: jasmine.createSpy('disconnect'), on: jasmine.createSpy('on'), emit: jasmine.createSpy('emit') };
    });

    /** Ensures the service successfully instantiates without throwing any dependency injection errors. */
    it('should create the service', () => {
 expect(service).toBeTruthy(); 
});

    /** Confirms that the critical foundational namespaces required for core application functionality are booted up automatically upon service creation. */
    it('should auto-connect Admin and Games namespaces on construction', () => {
        expect(service['sockets'].has(SocketNamespace.Admin)).toBe(true);
        expect(service['sockets'].has(SocketNamespace.Games)).toBe(true);
    });

    describe('connect / disconnect', () => {
        /** Instantiates and maps a fresh socket.io client specifically when a new, unmapped namespace is requested. */
        it('should create a socket when connecting a new namespace', () => {
            service.connectNamespace('/test');
            expect(service['sockets'].has('/test')).toBeTruthy();
        });

        /** Prevents memory leaks and connection duplication by silently skipping the connection process if the requested namespace is already mapped. */
        it('should not create a second socket if the namespace already exists', () => {
            service['sockets'].set('/test', mockSocket as never);
            const sizeBefore = service['sockets'].size;
            service.connectNamespace('/test');
            expect(service['sockets'].size).toBe(sizeBefore);
        });

        /** Safely closes the underlying connection and purges the namespace from the internal tracking map when requested. */
        it('should disconnect and remove the socket', () => {
            service['sockets'].set('/test', mockSocket as never);
            service.disconnectNamespace('/test');
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(service['sockets'].has('/test')).toBe(false);
        });

        /** Fails silently and safely without crashing the application if told to disconnect a namespace that doesn't exist. */
        it('should do nothing when disconnecting a namespace that does not exist', () => {
            service.disconnectNamespace('/nope');
            expect(mockSocket.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('on / emit', () => {
        /** Directly binds a functional callback to an event listener on the correct, namespace-specific socket instance. */
        it('should register an event listener on the socket', () => {
            service['sockets'].set('/test', mockSocket as never);
            const cb = jasmine.createSpy('callback');
            service.onNamespace('/test', 'testEvent', cb);
            expect(mockSocket.on).toHaveBeenCalledWith('testEvent', jasmine.any(Function));
        });

        /** Avoids fatal errors by silently ignoring registration attempts targeted at unmapped namespaces. */
        it('should silently skip onNamespace if the namespace does not exist', () => {
            service.onNamespace('/nope', 'testEvent', jasmine.createSpy());
            expect(mockSocket.on).not.toHaveBeenCalled();
        });

        /** Correctly packages and transmits specific payload data through the designated namespace socket. */
        it('should emit an event with data', () => {
            service['sockets'].set('/test', mockSocket as never);
            service.emitNamespace('/test', 'testEvent', { key: 'value' });
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', { key: 'value' });
        });

        /** Transmits a simple ping or command without any attached payload structure. */
        it('should emit without data', () => {
            service['sockets'].set('/test', mockSocket as never);
            service.emitNamespace('/test', 'testEvent');
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', undefined);
        });

        /** Protects the application state from crashing by ignoring outgoing emit requests directed at unmapped namespaces. */
        it('should silently skip emit if the namespace does not exist', () => {
            service.emitNamespace('/nope', 'testEvent', { key: 'value' });
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('isConnected', () => {
        /** Accurately reports a disconnected status when queried for a namespace that has not been initialized. */
        it('should return false for a missing namespace', () => {
 expect(service.isConnectedNamespace('/nope')).toBe(false); 
});

        /** Validates that the service correctly mirrors the internal `connected` property of the underlying socket.io client. */
        it('should return false when the socket is not connected', () => {
            service['sockets'].set('/test', mockSocket as never);
            mockSocket.connected = false;
            expect(service.isConnectedNamespace('/test')).toBe(false);
        });

        /** Successfully confirms an active, healthy connection link to the specific namespace. */
        it('should return true when the socket is connected', () => {
            service['sockets'].set('/test', mockSocket as never);
            mockSocket.connected = true;
            expect(service.isConnectedNamespace('/test')).toBe(true);
        });
    });

    describe('Lifecycle', () => {
        /** Performs a comprehensive, aggressive teardown procedure, forcing all active sockets in the map to terminate to ensure zero lingering connections on destroy. */
        it('should disconnect all sockets on destroy', () => {
            const mock2 = { connected: false, disconnect: jasmine.createSpy(), on: jasmine.createSpy(), emit: jasmine.createSpy() };
            service['sockets'].set('/test1', mockSocket as never);
            service['sockets'].set('/test2', mock2 as never);
            service.ngOnDestroy();
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(mock2.disconnect).toHaveBeenCalled();
            expect(service['sockets'].size).toBe(0);
        });

        /** Executes the destruction lifecycle hook gracefully even if the internal map was already completely emptied. */
        it('should handle destroy with no sockets at all', () => {
            service['sockets'].clear();
            expect(() => service.ngOnDestroy()).not.toThrow();
        });
    });
});