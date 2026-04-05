import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { LoadingComponent } from '@app/components/loading/loading.component';
import { LobbyCardComponent } from '@app/components/lobby-card/lobby-card.component';
import { ROUTES } from '@app/constants/routes.constants';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { ButtonVariant, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';

// The page after clicking "Joindre une partie"
@Component({
    selector: 'app-join-game-page',
    imports: [ButtonComponent, LobbyCardComponent, LoadingComponent],
    templateUrl: './join-game-page.component.html',
    styleUrl: './join-game-page.component.scss',
})
export class JoinGamePageComponent implements OnInit, OnDestroy {
    protected readonly buttonVariant = ButtonVariant;
    private readonly webSocketService = inject(WebSocketService);
    private readonly router = inject(Router);
    readonly routes = ROUTES;

    activeLobbies: Lobby[] = [];
    isLoading = true;
    isReady = false;

    ngOnInit(): void {
        this.webSocketService.onNamespace<Lobby[]>(SocketNamespace.Join, JoinGameEvents.UpdatedLobbiesList, (availableLobbies) => {
            this.activeLobbies = availableLobbies;
            this.isLoading = false;
        });

        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.LobbyJoined, (lobbyData) =>
            this.router.navigate([this.routes.waitingRoom, lobbyData.lobbyId], { state: { lobby: lobbyData } }),
        );

        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.GetLobbies);
    }

    ngOnDestroy(): void {
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.UpdatedLobbiesList);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyJoined);
    }

    selectLobby(lobby: Lobby): void {
        this.router.navigate(['/character-selection', lobby.lobbyId], { state: { game: lobby.game } });
    }
}
