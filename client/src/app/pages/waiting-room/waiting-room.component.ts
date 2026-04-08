import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { ROUTES } from '@app/constants/routes.constants';
import { ChatService } from '@app/services/chat/chat.service';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import swal from 'sweetalert2';
const SMALL_DELAY = 100;
const TOAST_DELAY = 4000;

@Component({
    selector: 'app-waiting-room',
    standalone: true,
    imports: [CommonModule, ButtonComponent, ChatComponent],
    templateUrl: './waiting-room.component.html',
    styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
    lobbyId = signal<string | null>(null);
    currentLobby = signal<Lobby | undefined>(undefined);
    private readonly webSocketService = inject(WebSocketService);
    private readonly chatService = inject(ChatService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly gameViewService = inject(GameViewService);
    private readonly routes = ROUTES;

    ngOnInit(): void {
        this.lobbyId.set(this.route.snapshot.paramMap.get('lobbyId'));

        if (!this.lobbyId()) {
            this.router.navigate([this.routes.home]);
            return;
        }

        // On F5, sessionStorage flag is missing → redirect to home
        const navigatedKey = 'waitingRoom_' + this.lobbyId();
        if (!sessionStorage.getItem(navigatedKey)) {
            const state = history.state;
            if (state && state.lobby) {
                sessionStorage.setItem(navigatedKey, 'true');
                this.currentLobby.set(state.lobby);
                this.setupUpdateListeners();
                return;
            }
            this.router.navigate([this.routes.home]);
            return;
        }
        sessionStorage.removeItem(navigatedKey);
        this.router.navigate([this.routes.home]);
    }

    private setupUpdateListeners(): void {
        // Listener for lobby updates
        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.LobbyUpdated, (updatedLobby) => {
            this.currentLobby.set(updatedLobby);
        });


        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived, (updatedLobby) => {
            this.currentLobby.set(updatedLobby);
            this.chatService.requestHistory(updatedLobby.lobbyId);
        });

        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.GameStarting, (finalLobby) => {
            this.gameViewService.setLobby(finalLobby);
            this.router.navigate(['/game', finalLobby.lobbyId]);
        });

        this.webSocketService.onNamespace<string>(SocketNamespace.Join, JoinGameEvents.PlayerKicked, (msg) => {
            this.router.navigate([this.routes.home]);
            swal.fire('Oh oh!', msg, 'warning');
        });

        this.webSocketService.onNamespace<void>(SocketNamespace.Join, JoinGameEvents.GameDeleted, () => {
            this.router.navigate([ROUTES.home]);
            swal.fire('Partie annulée', "L'organisateur a quitté le salon.", 'info');
        });

        this.webSocketService.onNamespace<Player>(SocketNamespace.Join, JoinGameEvents.PlayerJoined, (player) => {
            swal.fire({
                title: 'Nouveau joueur',
                text: `${player.character.name} a rejoint le salon.`,
                toast: true,
                position: 'top-start',
                timer: TOAST_DELAY,
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    popup: 'swal2-toast',
                },
            });
        });

        this.webSocketService.onNamespace<Player>(SocketNamespace.Join, JoinGameEvents.PlayerLeft, (player) => {
            swal.fire({
                title: 'Joueur parti',
                text: `${player.character.name} a quitté le salon.`,
                toast: true,
                position: 'top-start',
                timer: TOAST_DELAY,
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    popup: 'swal2-toast',
                },
            });
        });
    }

    ngOnDestroy(): void {
        const id = this.lobbyId();
        if (id) sessionStorage.removeItem('waitingRoom_' + id);

        this.webSocketService.offMultiple(SocketNamespace.Join, [
            JoinGameEvents.LobbyUpdated,
            JoinGameEvents.LobbyStatusReceived,
            JoinGameEvents.GameStarting,
            JoinGameEvents.PlayerKicked,
            JoinGameEvents.GameDeleted,
            JoinGameEvents.PlayerJoined,
            JoinGameEvents.PlayerLeft,
        ]);
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
        const playerCount = lobby?.playerCount ?? 0;

        if (lobby?.game.gameMode === GameMode.Classic) {
            return this.isOrganizer() && playerCount >= 2;
        } else {
            return this.isOrganizer() && playerCount >=2 && playerCount % 2 === 0;
        }
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
        swal.close();
        
        if (this.canStartGame()) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.StartGame, this.lobbyId());
        }
    }

    onToggleLock(): void {
        if (this.isOrganizer()) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.ToggleLock, this.lobbyId());
        }
    }

    @HostListener('window:popstate')
    onBrowserBack(): void {
        this.leaveLobby();
    }

    leaveLobby(): void {
        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
        setTimeout(() => {
            this.router.navigate(['/home']);
        }, SMALL_DELAY);
    }
}
