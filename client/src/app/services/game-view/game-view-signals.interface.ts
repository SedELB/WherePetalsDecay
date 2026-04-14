import { WritableSignal } from '@angular/core';
import { SocketNamespace } from '@common/enums';
import { CombatLockStateData, GameOverEventData, TileInfoData } from '@common/interfaces/game-view';
import { Lobby } from '@common/lobby';
import { Vec2 } from '@common/vec2';

export interface GameViewSignals {
    namespace: SocketNamespace;

    // Writable signals exposed for listeners
    isDebugModeActive: WritableSignal<boolean>;
    disableEndTurn: WritableSignal<boolean>;
    gameLobby: WritableSignal<Lobby | null>;
    playerPositions: WritableSignal<Record<string, Vec2>>;
    playerStartPositions: WritableSignal<Record<string, Vec2>>;
    turnOrder: WritableSignal<string[]>;
    activePlayerSocketId: WritableSignal<string | null>;
    turnCountdown: WritableSignal<number>;
    reachableTiles: WritableSignal<Vec2[]>;
    reachableTilesForTeleport: WritableSignal<Vec2[]>;
    movementPoints: WritableSignal<number>;
    actionPoints: WritableSignal<number>;
    tileInfo: WritableSignal<TileInfoData | null>;
    turnNotification: WritableSignal<string | null>;
    inactiveSanctuaries: WritableSignal<Vec2[]>;
    journalEntries: WritableSignal<string[]>;
    isFlagTaken: WritableSignal<boolean>;
    combatLockState: WritableSignal<CombatLockStateData | null>;

    // Methods delegated from the main service
    getLocalSocketId(): string | undefined;
    setLobby(lobby: Lobby | null): void;
    resetGameState(): void;
    showFirstTurnNotification(order: string[], lobby: Lobby): void;
    showNextTurnNotification(endedPlayerSocketId: string): void;
    handleGameOverEvent(data: GameOverEventData): void;
    closeFlagTransferSwalIfOpen(): void;
    promptFlagTransfer(requesterId: string, requesterName: string, lobbyId: string, isRequest?: boolean): void;
    expandSanctuaryPositions(topLeftList: Vec2[]): Vec2[];
    triggerDoorAnimation(x: number, y: number, newType: import('@common/enums').TileTexture): void;
}
