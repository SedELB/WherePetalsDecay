import { Injectable, OnDestroy } from '@angular/core';
import { SocketNamespace } from '@common/enums';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
    private sockets: Map<string, Socket> = new Map();
    private readonly serverUrl = environment.serverUrl.replace('/api', '');

    constructor() {
        // Connexions automatiques pour admin et games
        this.connectNamespace(SocketNamespace.Admin);
        this.connectNamespace(SocketNamespace.Games);
    }

    connectNamespace(namespace: string): void {
        if (this.sockets.has(namespace)) {
            return;
        }

        const socket = io(`${this.serverUrl}${namespace}`, { transports: ['websocket'] });
        this.sockets.set(namespace, socket);
    }

    disconnectNamespace(namespace: string): void {
        const socket = this.sockets.get(namespace);
        if (socket) {
            socket.disconnect();
            this.sockets.delete(namespace);
        }
    }

    onNamespace<T>(namespace: string, event: string, callback: (data: T) => void): void {
        const socket = this.sockets.get(namespace);
        socket?.on(event, callback as (...args: unknown[]) => void);
    }

    offNamespace(namespace: string, event: string): void {
        const socket = this.sockets.get(namespace);
        socket?.off(event);
    }

    emitNamespace<T>(namespace: string, event: string, data?: T): void {
        const socket = this.sockets.get(namespace);
        socket?.emit(event, data);
    }

    isConnectedNamespace(namespace: string): boolean {
        return this.sockets.get(namespace)?.connected ?? false;
    }

    getSocketId(namespace: string): string | undefined {
        return this.sockets.get(namespace)?.id;
    }

    ngOnDestroy(): void {
        this.sockets.forEach((socket) => socket.disconnect());
        this.sockets.clear();
    }
}
