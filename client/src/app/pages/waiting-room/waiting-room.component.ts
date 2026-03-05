import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Room } from '@common/room';
import { Player } from '@common/player';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-waiting-room',
    standalone: true,
    imports: [CommonModule, ButtonComponent],
    templateUrl: './waiting-room.component.html',
    styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
    room: Room | null = null;
    currentPlayerId: string = '';
    private roomSubscription: Subscription | null = null;

    selectedGame: Game;
    private readonly webSocketService = inject(WebSocketService);

    constructor(
        private readonly waitingRoomService: WaitingRoomService,
        private readonly router: Router,
    ) {
        const navigation = this.router.getCurrentNavigation();
        const state = navigation?.extras.state as { roomCode?: string; playerId?: string };
        if (state?.playerId) {
            this.currentPlayerId = state.playerId;
        }
    }

    ngOnInit(): void {
        this.waitingRoomService.connect();
        this.roomSubscription = this.waitingRoomService.room$.subscribe((room) => {
            this.room = room;
        });

        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.GetLobbyStatus);
        this.webSocketService.onNamespace(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived, (lobbyData: Lobby) => {
            this.selectedGame = lobbyData.game;
        });
    }

    ngOnDestroy(): void {
        this.roomSubscription?.unsubscribe();
        this.waitingRoomService.disconnect();

        if (this.selectedGame) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby, this.selectedGame._id.toString());
        }
        this.webSocketService.off(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived);
    }

    get isOrganizer(): boolean {
        return this.room?.organizerId === this.currentPlayerId;
    }

    get canStartGame(): boolean {
        return this.isOrganizer && (this.room?.players.length ?? 0) >= 2;
    }

    get players(): Player[] {
        if (!this.room) return [];
        const organizer = this.room.players.find((p) => p.isHost);
        const others = this.room.players.filter((p) => !p.isHost);
        return organizer ? [organizer, ...others] : others;
    }

    onKickPlayer(playerId: string): void {
        if (this.isOrganizer && playerId !== this.currentPlayerId) {
            this.waitingRoomService.kickPlayer(playerId);
        }
    }

    onStartGame(): void {
        if (this.canStartGame) {
            this.waitingRoomService.startGame();
        }
    }

    onToggleLock(): void {
        if (this.isOrganizer) {
            this.waitingRoomService.toggleLock();
        }
    }

    onLeaveRoom(): void {
        this.waitingRoomService.leaveRoom();
        this.router.navigate(['/home']);
    }

    leaveLobby(): void {
        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
    }
}
