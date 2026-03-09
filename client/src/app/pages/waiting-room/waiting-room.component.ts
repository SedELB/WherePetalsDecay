import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Lobby } from '@common/lobby';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { ROUTES } from '@app/constants/routes.constants';
import swal from 'sweetalert2';
const SMALL_DELAY = 100;

@Component({
    selector: 'app-waiting-room',
    standalone: true,
    imports: [CommonModule, ButtonComponent],
    templateUrl: './waiting-room.component.html',
    styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
    lobbyId = signal<string | null>(null);
    currentLobby = signal<Lobby | undefined>(undefined);
    private readonly webSocketService = inject(WebSocketService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly routes = ROUTES;

    ngOnInit(): void {
        this.lobbyId.set(this.route.snapshot.paramMap.get('lobbyId'));

        if (!this.lobbyId()) {
            this.router.navigate([this.routes.home]);
            return;
        }

        const state = history.state;
        if (state && state.lobby) {
            this.currentLobby.set(state.lobby);
        } else {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.GetLobbyStatus);
        }

        this.setupUpdateListeners();
    }

    setupUpdateListeners(): void {
        // Listener for lobby updates
        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.LobbyUpdated, (updatedLobby) => {
            this.currentLobby.set(updatedLobby);
        });

        // Listener for getting Lobby status after a refresh
        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived, (updatedLobby) => {
            this.currentLobby.set(updatedLobby);
        });

        // Listener for redirecting after game start.
        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.GameStarting, (finalLobby) => {
            this.router.navigate(['/game', finalLobby.lobbyId], { state: { lobby: finalLobby } });
        });

        // Listener for player kick
        this.webSocketService.onNamespace<string>(SocketNamespace.Join, JoinGameEvents.PlayerKicked, (msg) => {
            this.router.navigate([this.routes.home]);
            swal.fire('Oh oh!', msg, 'warning');
        });

        // Listener for host leaving
        this.webSocketService.onNamespace<void>(SocketNamespace.Join, JoinGameEvents.GameDeleted, () => {
            this.router.navigate([ROUTES.home]);
            swal.fire('Partie annulée', "L'organisateur a quitté le salon.", 'info');
        });
    }

    ngOnDestroy(): void {
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyUpdated);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.GameStarting);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.PlayerKicked);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.GameDeleted);
    }

    currentPlayer = computed(() => {
        const lobby = this.currentLobby();
        if (!lobby) return undefined;
        return lobby.players.find((p) => p.socketId === this.webSocketService.getSocketId(SocketNamespace.Join));
    });

    isOrganizer = computed(() => {
        return this.currentLobby()?.hostSocketId === this.currentPlayer()?.socketId;
    });

    canStartGame = computed(() => {
        const lobby = this.currentLobby();
        return this.isOrganizer() && (lobby?.playerCount ?? 0) >= 2;
    });

    players = computed(() => {
        const lobby = this.currentLobby();
        if (!lobby) return [];

        const organizer = lobby.players.find((p) => p.socketId === lobby.hostSocketId);
        const others = lobby.players.filter((p) => p.socketId !== lobby.hostSocketId);
        return organizer ? [organizer, ...others] : others;
    });

    onKickPlayer(targetSocketId: string): void {
        if (this.isOrganizer() && targetSocketId !== this.currentPlayer()?.socketId) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.KickPlayer, {
                lobbyId: this.lobbyId(),
                targetSocketId,
            });
        }
    }

    onStartGame(): void {
        if (this.canStartGame()) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.StartGame, this.lobbyId());
        }
    }

    onToggleLock(): void {
        if (this.isOrganizer()) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.ToggleLock, this.lobbyId());
        }
    }

    leaveLobby(): void {
        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
        setTimeout(() => {
            this.router.navigate(['/home']);
        }, SMALL_DELAY);
    }
}
