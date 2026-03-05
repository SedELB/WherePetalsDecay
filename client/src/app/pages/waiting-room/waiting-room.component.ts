import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
const SMALL_DELAY = 100;
@Component({
    selector: 'app-waiting-room',
    standalone: true,
    imports: [ButtonComponent],
    templateUrl: './waiting-room.component.html',
    styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
    selectedGame: Game;
    private readonly webSocketService = inject(WebSocketService);
    private router: Router = inject(Router);

    ngOnInit(): void {
        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.GetLobbyStatus);

        this.webSocketService.onNamespace(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived, (lobbyData: Lobby) => {
            this.selectedGame = lobbyData.game;
        });
    }

    ngOnDestroy(): void {
        if (this.selectedGame) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby, this.selectedGame._id.toString());
        }
        
        this.webSocketService.off(SocketNamespace.Join, JoinGameEvents.LobbyStatusReceived);
    }

    leaveLobby() {
        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
        setTimeout(() => {
            this.router.navigate(['/home']);
        }, SMALL_DELAY);
    }
}