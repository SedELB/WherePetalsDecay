import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { Room } from '@common/room';
import { Player } from '@common/player';
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

    constructor(
        private readonly waitingRoomService: WaitingRoomService,
        private readonly router: Router,
    ) {
        // Récupérer les données de navigation (si créateur/organisateur)
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
    }

    ngOnDestroy(): void {
        this.roomSubscription?.unsubscribe();
        this.waitingRoomService.disconnect();
    }

    get isOrganizer(): boolean {
        return this.room?.organizerId === this.currentPlayerId;
    }

    get canStartGame(): boolean {
        return this.isOrganizer && (this.room?.players.length ?? 0) >= 2;
    }

    get players(): Player[] {
        if (!this.room) return [];
        // Organisateur en premier, puis les autres dans l'ordre d'arrivée
        const organizer = this.room.players.find((p) => p.isOrganizer);
        const others = this.room.players.filter((p) => !p.isOrganizer);
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
}
