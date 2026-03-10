import { Injectable, signal } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';

@Injectable({
    providedIn: 'root',
})
export class GameViewService {
    private readonly namespace = SocketNamespace.Join;
    readonly gameLobby = signal<Lobby | null>(null);

    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly router: Router,
    ) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace<Lobby>(this.namespace, JoinGameEvents.GameLobbyUpdated, (lobby) => {
            this.setLobby(lobby);
        });
        this.webSocketService.onNamespace(this.namespace, JoinGameEvents.LeftLobby, () => {
            this.setLobby(null);
            this.router.navigate([ROUTES.home]);
        });
    }

    // Emit
    sendEndTurn(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.EndTurn, lobbyId);
    }

    sendAbandon(lobbyId: string): void {
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.PlayerAbandon, lobbyId);
    }

    sendAction(lobbyId: string, action: null): void {
        // TODO: replace null with actual action type
        this.webSocketService.emitNamespace(this.namespace, JoinGameEvents.PlayerAction, { lobbyId, action });
    }

    // utils
    setLobby(gameLobby: Lobby | null): void {
        this.gameLobby.set(gameLobby);
    }

    getLocalSocketId(): string | undefined {
        return this.webSocketService.getSocketId(this.namespace);
    }
}
