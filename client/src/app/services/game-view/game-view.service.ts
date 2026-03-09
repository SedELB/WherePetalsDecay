import { Injectable, signal } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';

@Injectable({
    providedIn: 'root',
})
export class GameViewService {
    private readonly namespace = SocketNamespace.Join;
    readonly gameLobby = signal<Lobby | null>(null);

    constructor(private readonly webSocketService: WebSocketService) {
        this.setupWebSocketListeners();
    }

    private setupWebSocketListeners(): void {
        this.webSocketService.onNamespace<Lobby>(this.namespace, JoinGameEvents.GameStarting, (lobby) => {
            this.setGames(lobby);
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
    setGames(gameLobby: Lobby): void {
        this.gameLobby.set(gameLobby);
    }

    getLocalSocketId(): string | undefined {
        return this.webSocketService.getSocketId(this.namespace);
    }
}
