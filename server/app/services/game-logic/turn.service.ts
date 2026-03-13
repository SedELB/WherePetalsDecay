import { Injectable } from '@nestjs/common';
import { ActiveGame, SECOND, TURN_DELAY, TURN_DURATION, TurnCallbacks } from './active-game.interface';

@Injectable()
export class TurnService {
    constructor() {
        this.turnTimers = new Map<string, NodeJS.Timeout>();
        this.delayTimers = new Map<string, NodeJS.Timeout>();
    }

    private turnTimers: Map<string, NodeJS.Timeout>;
    private delayTimers: Map<string, NodeJS.Timeout>;
    private callbacks: TurnCallbacks;

    setCallbacks(callbacks: TurnCallbacks): void {
        this.callbacks = callbacks;
    }

    startTurnCycle(game: ActiveGame): void {
        this.startCountdown(game);
    }

    endTurn(game: ActiveGame): void {
        const lobbyId = game.lobby.lobbyId;
        this.clearTimers(lobbyId);

        const currentSocketId = game.turnOrder[game.currentTurnIndex];
        this.callbacks.onTurnEnded(lobbyId, currentSocketId);

        this.advanceToNextPlayer(game);
        this.startCountdown(game);
    }

    isPlayerTurn(game: ActiveGame, socketId: string): boolean {
        return game.turnOrder[game.currentTurnIndex] === socketId;
    }

    stopTurnCycle(lobbyId: string): void {
        this.clearTimers(lobbyId);
    }

    private startCountdown(game: ActiveGame): void {
        const lobbyId = game.lobby.lobbyId;
        let secondsLeft = TURN_DELAY;

        this.callbacks.onTurnCountdown(lobbyId, secondsLeft);

        const delayTimer = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                clearInterval(delayTimer);
                this.delayTimers.delete(lobbyId);
                this.startTurn(game);
            } else {
                this.callbacks.onTurnCountdown(lobbyId, secondsLeft);
            }
        }, SECOND);

        this.delayTimers.set(lobbyId, delayTimer);
    }

    private startTurn(game: ActiveGame): void {
        const lobbyId = game.lobby.lobbyId;
        const currentSocketId = game.turnOrder[game.currentTurnIndex];
        const player = game.lobby.players.find((p) => p.socketId === currentSocketId);
        if (!player) return;

        game.movementPoints.set(currentSocketId, player.character.speed);
        game.hasCombatted.set(currentSocketId, false);

        this.callbacks.onTurnStarted(lobbyId, currentSocketId);

        let secondsLeft = TURN_DURATION;
        this.callbacks.onTurnCountdown(lobbyId, secondsLeft);

        const turnTimer = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                clearInterval(turnTimer);
                this.turnTimers.delete(lobbyId);
                this.endTurn(game);
            } else {
                this.callbacks.onTurnCountdown(lobbyId, secondsLeft);
            }
        }, SECOND);

        this.turnTimers.set(lobbyId, turnTimer);
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
