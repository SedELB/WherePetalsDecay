import { Injectable } from '@angular/core';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { SocketNamespace } from '@common/enums';
import {
    CombatAttackAnimationData,
    CombatEndedData,
    CombatResult,
    CombatRoundCountdownData,
    CombatRoundResolvedData,
    CombatRoundStartedData,
    CombatStartedData,
    PostureReceivedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { GameViewCombatService, CombatListenerDependencies } from '@app/services/game-view/game-view-combat.service';

@Injectable({
    providedIn: 'root',
})
export class GameViewCombatListenersService {
    constructor(
        private readonly webSocketService: WebSocketService,
        private readonly gameViewCombatService: GameViewCombatService,
    ) {}

    setupListeners(namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.registerCombatResultListener(namespace, dependencies);
        this.registerCombatEndedListener(namespace, dependencies);
        this.registerCombatStartedListener(namespace, dependencies);
        this.registerCombatRoundStartedListener(namespace);
        this.registerCombatRoundCountdownListener(namespace);
        this.registerCombatRoundResolvedListener(namespace, dependencies);
        this.registerCombatAttackAnimationListener(namespace, dependencies);
        this.registerPostureReceivedListener(namespace);
    }

    private registerCombatResultListener(namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.webSocketService.onNamespace<CombatResult>(namespace, JoinGameEvents.CombatResult, (data) => {
            this.gameViewCombatService.handleCombatResult(data, dependencies);
        });
    }

    private registerCombatEndedListener(namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.webSocketService.onNamespace<CombatEndedData>(namespace, JoinGameEvents.CombatEnded, (data) => {
            const localId = dependencies.getLocalSocketId();
            const players = dependencies.getGameLobby()?.players ?? [];
            this.gameViewCombatService.handleCombatEnded(data, players, localId);
        });
    }

    private registerCombatStartedListener(namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.webSocketService.onNamespace<CombatStartedData>(namespace, JoinGameEvents.CombatStarted, (data) => {
            this.gameViewCombatService.handleCombatStarted(data, dependencies.getLocalSocketId());
        });
    }

    private registerCombatRoundStartedListener(namespace: SocketNamespace): void {
        this.webSocketService.onNamespace<CombatRoundStartedData>(namespace, JoinGameEvents.CombatRoundStarted, (data) => {
            this.gameViewCombatService.handleCombatRoundStarted(data);
        });
    }

    private registerCombatRoundCountdownListener(namespace: SocketNamespace): void {
        this.webSocketService.onNamespace<CombatRoundCountdownData>(namespace, JoinGameEvents.CombatRoundCountdown, (data) => {
            this.gameViewCombatService.handleCombatRoundCountdown(data);
        });
    }

    private registerCombatRoundResolvedListener(namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.webSocketService.onNamespace<CombatRoundResolvedData>(namespace, JoinGameEvents.CombatRoundResolved, (data) => {
            this.gameViewCombatService.handleCombatRoundResolved(data, dependencies.getLocalSocketId());
        });
    }

    private registerCombatAttackAnimationListener(namespace: SocketNamespace, dependencies: CombatListenerDependencies): void {
        this.webSocketService.onNamespace<CombatAttackAnimationData>(namespace, JoinGameEvents.CombatAttackAnimation, (data) => {
            this.gameViewCombatService.handleCombatAttackAnimation(data, dependencies.getLocalSocketId());
        });
    }

    private registerPostureReceivedListener(namespace: SocketNamespace): void {
        this.webSocketService.onNamespace<PostureReceivedData>(namespace, JoinGameEvents.PostureReceived, (data) => {
            this.gameViewCombatService.handlePostureReceived(data);
        });
    }
}
