import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { ROUTES } from '@app/constants/routes.constants';
import { LobbyCardComponent } from '@app/components/lobby-card/lobby-card.component';

// The page after clicking "Joindre une partie"
@Component({
  selector: 'app-join-game-page',
  imports: [ButtonComponent, LobbyCardComponent],
  templateUrl: './join-game-page.component.html',
  styleUrl: './join-game-page.component.scss',
})
export class JoinGamePageComponent implements OnInit, OnDestroy {
  private readonly webSocketService = inject(WebSocketService);
  private readonly router = inject(Router);
  readonly routes = ROUTES;
  
  activeLobbies: Lobby[] = [];
  
  ngOnInit(): void {
    // Listener for updating available lobbies
    this.webSocketService.onNamespace<Lobby[]>(
      SocketNamespace.Join,
      JoinGameEvents.UpdatedLobbiesList,
      (availableLobbies) => {
        this.activeLobbies = availableLobbies;
      },
    );

    // Listener for joining a game after backend confirmation
    this.webSocketService.onNamespace<Lobby>(
      SocketNamespace.Join,
      JoinGameEvents.LobbyJoined,
      (lobbyData) => this.router.navigate([this.routes.waitingRoom, lobbyData.lobbyId], {state: {lobby: lobbyData}}),
    );

    // Emit event to get available lobbies on init.
    this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.GetLobbies);
  }

  ngOnDestroy(): void {
    this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.UpdatedLobbiesList);
    this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyJoined);
  }

  selectLobby(lobby: Lobby) {
    this.router.navigate(['/character-selection', lobby.lobbyId], {state: {game: lobby.game}});
  }
}
