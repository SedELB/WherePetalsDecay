import { TurnPhase } from '@common/enums';
import { Injectable } from '@nestjs/common';
import { ActiveGame, MAX_ACTION_POINTS, SECOND, TURN_DELAY, TURN_DURATION, TurnCallbacks } from './active-game.interface';


interface TurnCycleSnapshot {
    phase: TurnPhase;
    secondsLeft: number;
}

@Injectable()
export class TurnService {
    constructor() {
        this.turnTimers = new Map<string, NodeJS.Timeout>();
        this.delayTimers = new Map<string, NodeJS.Timeout>();
        this.turnSnapshots = new Map<string, TurnCycleSnapshot>();
        this.pausedLobbies = new Set<string>();
    }

    private turnTimers: Map<string, NodeJS.Timeout>;
    private delayTimers: Map<string, NodeJS.Timeout>;
    private turnSnapshots: Map<string, TurnCycleSnapshot>;
    private pausedLobbies: Set<string>;
    private callbacks: TurnCallbacks;

    setCallbacks(callbacks: TurnCallbacks): void {
        this.callbacks = callbacks;
    }

    startTurnCycle(game: ActiveGame): void {
        const lobbyId = game.lobby.lobbyId;
        this.pausedLobbies.delete(lobbyId);
        this.turnSnapshots.delete(lobbyId);
        this.startCountdown(game, TURN_DELAY);
    }

    endTurn(game: ActiveGame): void {
        const lobbyId = game.lobby.lobbyId;
        this.clearTimers(lobbyId);
        this.pausedLobbies.delete(lobbyId);
        this.turnSnapshots.delete(lobbyId);

        game.totalTurns += 1;

        const currentSocketId = game.turnOrder[game.currentTurnIndex];
        this.callbacks.onTurnEnded(lobbyId, currentSocketId);

        this.advanceToNextPlayer(game);
        this.startCountdown(game, TURN_DELAY);
    }

    isPlayerTurn(game: ActiveGame, socketId: string): boolean {
        const snapshot = this.turnSnapshots.get(game.lobby.lobbyId);
        if (!snapshot || snapshot.phase !== TurnPhase.ActiveTurn) return false;
        return game.turnOrder[game.currentTurnIndex] === socketId;
    }

    pauseTurnCycle(lobbyId: string): boolean {
        const snapshot = this.turnSnapshots.get(lobbyId);
        if (!snapshot) return false;

        this.clearTimers(lobbyId);
        this.pausedLobbies.add(lobbyId);
        return true;
    }

    resumeTurnCycle(game: ActiveGame): boolean {
        const lobbyId = game.lobby.lobbyId;
        if (!this.pausedLobbies.has(lobbyId)) return false;

        const snapshot = this.turnSnapshots.get(lobbyId);
        if (!snapshot) {
            this.pausedLobbies.delete(lobbyId);
            return false;
        }

        this.pausedLobbies.delete(lobbyId);
        if (snapshot.phase === TurnPhase.BetweenTurn) {
            this.startCountdown(game, snapshot.secondsLeft);
            return true;
        }

        this.startTurnTimer(game, snapshot.secondsLeft);
        return true;
    }

    stopTurnCycle(lobbyId: string): void {
        this.clearTimers(lobbyId);
        this.pausedLobbies.delete(lobbyId);
        this.turnSnapshots.delete(lobbyId);
    }

    private startCountdown(game: ActiveGame, initialSeconds: number): void {
        const lobbyId = game.lobby.lobbyId;
        if (initialSeconds <= 0) {
            this.beginTurn(game);
            return;
        }

        let secondsLeft = initialSeconds;
        this.turnSnapshots.set(lobbyId, { phase: TurnPhase.BetweenTurn, secondsLeft });

        const delayTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                clearInterval(delayTimer);
                this.delayTimers.delete(lobbyId);
                this.beginTurn(game);
            } else {
                this.turnSnapshots.set(lobbyId, { phase: TurnPhase.BetweenTurn, secondsLeft });
                this.callbacks.onBetweenTurnCountdown(lobbyId, secondsLeft);
            }
        }, SECOND);

        this.delayTimers.set(lobbyId, delayTimer);
        this.callbacks.onBetweenTurnCountdown(lobbyId, initialSeconds);
    }

    private beginTurn(game: ActiveGame): void {
        const lobbyId = game.lobby.lobbyId;
        const currentSocketId = game.turnOrder[game.currentTurnIndex];
        const player = game.lobby.players.find((p) => p.socketId === currentSocketId);
        if (!player) return;

        game.movementPoints.set(currentSocketId, player.character.speed);
        game.actionPoints.set(currentSocketId, MAX_ACTION_POINTS);

        this.startTurnTimer(game, TURN_DURATION);
        this.callbacks.onTurnStarted(lobbyId, currentSocketId);
    }

    private startTurnTimer(game: ActiveGame, initialSeconds: number): void {
        const lobbyId = game.lobby.lobbyId;
        if (initialSeconds <= 0) {
            this.endTurn(game);
            return;
        }

        let secondsLeft = initialSeconds;
        this.turnSnapshots.set(lobbyId, { phase: TurnPhase.ActiveTurn, secondsLeft });
        const turnTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                clearInterval(turnTimer);
                this.turnTimers.delete(lobbyId);
                this.endTurn(game);
            } else {
                this.turnSnapshots.set(lobbyId, { phase: TurnPhase.ActiveTurn, secondsLeft });
                this.callbacks.onTurnCountdown(lobbyId, secondsLeft);
            }
        }, SECOND);

        this.turnTimers.set(lobbyId, turnTimer);
        this.callbacks.onTurnCountdown(lobbyId, initialSeconds);
    }

    private advanceToNextPlayer(game: ActiveGame): void {
        const activePlayers = game.lobby.players.filter((p) => !p.hasAbandonned);
        if (activePlayers.length === 0) return;

        let nextIndex = game.currentTurnIndex;
        do {
            nextIndex = (nextIndex + 1) % game.turnOrder.length;
        } while (!activePlayers.some((p) => p.socketId === game.turnOrder[nextIndex]));

        game.currentTurnIndex = nextIndex;
    }

    private clearTimers(lobbyId: string): void {
        const turnTimer = this.turnTimers.get(lobbyId);
        if (turnTimer) {
            clearInterval(turnTimer);
            this.turnTimers.delete(lobbyId);
        }

        const delayTimer = this.delayTimers.get(lobbyId);
        if (delayTimer) {
            clearInterval(delayTimer);
            this.delayTimers.delete(lobbyId);
        }
    }
}
