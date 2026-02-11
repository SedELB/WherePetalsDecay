import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
    private socket: Socket | null = null;
    private readonly serverUrl = environment.serverUrl.replace('/api', '');

    connect(): void {
        if (this.socket?.connected) {
            return;
        }

        this.socket = io(this.serverUrl, { transports: ['websocket'] });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on<T>(event: string, callback: (data: T) => void): void {
        this.socket?.on(event, callback as (...args: unknown[]) => void);
    }

    emit<T>(event: string, data?: T): void {
        this.socket?.emit(event, data);
    }

    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    ngOnDestroy(): void {
        this.disconnect();
    }
}