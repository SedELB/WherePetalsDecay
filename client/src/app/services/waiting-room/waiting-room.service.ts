import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Player } from '@common/player';
import { Room, RoomCreatePayload, RoomJoinPayload } from '@common/room';
import { SocketNamespace } from '@common/enums';
import { WaitingRoomEvents } from '@common/waiting-room-events';
import { BehaviorSubject, Observable } from 'rxjs';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';

@Injectable({
    providedIn: 'root',
})
export class WaitingRoomService implements OnDestroy {
    private roomSubject = new BehaviorSubject<Room | null>(null);
    private errorSubject = new BehaviorSubject<string | null>(null);
    private isConnected = false;

    room$: Observable<Room | null> = this.roomSubject.asObservable();
    error$: Observable<string | null> = this.errorSubject.asObservable();

    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
    ) {}

    connect(): void {
        if (this.isConnected) return;

        this.webSocketService.connectNamespace(SocketNamespace.WaitingRoom);
        this.setupListeners();
        this.isConnected = true;
    }

    disconnect(): void {
        if (!this.isConnected) return;

        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.LeaveRoom);
        this.webSocketService.disconnectNamespace(SocketNamespace.WaitingRoom);
        this.roomSubject.next(null);
        this.isConnected = false;
    }

    createRoom(payload: RoomCreatePayload): void {
        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.CreateRoom, payload);
    }

    joinRoom(payload: RoomJoinPayload): void {
        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.JoinRoom, payload);
    }

    leaveRoom(): void {
        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.LeaveRoom);
    }

    kickPlayer(playerId: string): void {
        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.KickPlayer, playerId);
    }

    startGame(): void {
        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.StartGame);
    }

    toggleLock(): void {
        this.webSocketService.emitNamespace(SocketNamespace.WaitingRoom, WaitingRoomEvents.ToggleLock);
    }

    get currentRoom(): Room | null {
        return this.roomSubject.value;
    }

    clearError(): void {
        this.errorSubject.next(null);
    }

    private setupListeners(): void {
        this.webSocketService.onNamespace<Room>(SocketNamespace.WaitingRoom, WaitingRoomEvents.RoomCreated, (room) => {
            this.roomSubject.next(room);
        });

        this.webSocketService.onNamespace<Room>(SocketNamespace.WaitingRoom, WaitingRoomEvents.RoomJoined, (room) => {
            this.roomSubject.next(room);
        });

        this.webSocketService.onNamespace<Room>(SocketNamespace.WaitingRoom, WaitingRoomEvents.RoomUpdated, (room) => {
            this.roomSubject.next(room);
        });

        this.webSocketService.onNamespace<Player>(SocketNamespace.WaitingRoom, WaitingRoomEvents.PlayerJoined, (player) => {
            const current = this.roomSubject.value;
            if (current) {
                this.roomSubject.next({
                    ...current,
                    players: [...current.players, player],
                });
            }
        });

        this.webSocketService.onNamespace<Player>(SocketNamespace.WaitingRoom, WaitingRoomEvents.PlayerLeft, (player) => {
            const current = this.roomSubject.value;
            if (current) {
                this.roomSubject.next({
                    ...current,
                    players: current.players.filter((p) => p.socketId !== player.socketId),
                });
            }
        });

        this.webSocketService.onNamespace<{ message: string }>(
            SocketNamespace.WaitingRoom,
            WaitingRoomEvents.PlayerKicked,
            (data) => {
                alert(data.message);
                this.roomSubject.next(null);
                this.router.navigate(['/home']);
            },
        );

        this.webSocketService.onNamespace<void>(SocketNamespace.WaitingRoom, WaitingRoomEvents.RoomLocked, () => {
            const current = this.roomSubject.value;
            if (current) {
                this.roomSubject.next({ ...current, isLocked: true });
            }
        });

        this.webSocketService.onNamespace<void>(SocketNamespace.WaitingRoom, WaitingRoomEvents.RoomUnlocked, () => {
            const current = this.roomSubject.value;
            if (current) {
                this.roomSubject.next({ ...current, isLocked: false });
            }
        });

        this.webSocketService.onNamespace<{ gameId: string; players: Player[] }>(
            SocketNamespace.WaitingRoom,
            WaitingRoomEvents.GameStarting,
            (data) => {
                this.router.navigate(['/game'], { state: data });
            },
        );

        this.webSocketService.onNamespace<{ message: string }>(
            SocketNamespace.WaitingRoom,
            WaitingRoomEvents.RoomClosed,
            (data) => {
                alert(data.message);
                this.roomSubject.next(null);
                this.router.navigate(['/home']);
            },
        );

        this.webSocketService.onNamespace<{ message: string }>(
            SocketNamespace.WaitingRoom,
            WaitingRoomEvents.Error,
            (data) => {
                this.errorSubject.next(data.message);
            },
        );
    }

    ngOnDestroy(): void {
        this.disconnect();
    }
}
