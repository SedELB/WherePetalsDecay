import { Posture } from '@common/character';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export const COMBAT_ROUND_DELAY_MS = 2000;
export const COMBAT_POSTURE_TIMEOUT_MS = 10000;
export const COUNTDOWN_TICK_MS = 1000;
export const ATTACK_ANIMATION_DURATION_MS = 2000;
export const DEFAULT_POSTURE: Posture = { type: null, bonus: 0 };
export const VP_POSTURE_MAX_DELAY_MS = 9000;

export interface CombatSession {
    lobbyId: string;
    roomId: string;
    attackerId: string;
    defenderId: string;
    postures: Map<string, Posture>;
    roundIndex: number;
    awaitingPostures: boolean;
    consumeActionPointOnNextRound: boolean;
    timeoutHandle?: ReturnType<typeof setTimeout>;
    countdownHandle?: ReturnType<typeof setInterval>;
    vpPostureHandles: ReturnType<typeof setTimeout>[];
}

@Injectable()
export class CombatSessionService {
    private fightCounter = 0;
    private readonly combatSessions = new Map<string, CombatSession>();

    incrementFightCounter(): number {
        return ++this.fightCounter;
    }

    getSession(roomId: string): CombatSession | undefined {
        return this.combatSessions.get(roomId);
    }

    createSession(session: CombatSession): void {
        this.combatSessions.set(session.roomId, session);
    }

    deleteSession(roomId: string): void {
        this.combatSessions.delete(roomId);
    }

    hasActiveCombatInLobby(lobbyId: string): boolean {
        return Array.from(this.combatSessions.values()).some((session) => session.lobbyId === lobbyId);
    }

    findCombatSessionByPlayer(socketId: string): CombatSession | undefined {
        return Array.from(this.combatSessions.values()).find((session) => session.attackerId === socketId || session.defenderId === socketId);
    }

    clearCombatSessionTimers(session: CombatSession): void {
        if (session.timeoutHandle) {
            clearTimeout(session.timeoutHandle);
            session.timeoutHandle = undefined;
        }

        if (session.countdownHandle) {
            clearInterval(session.countdownHandle);
            session.countdownHandle = undefined;
        }

        for (const handle of session.vpPostureHandles) {
            clearTimeout(handle);
        }
        session.vpPostureHandles = [];
    }

    cleanupCombatSession(server: Server, roomId: string): void {
        const session = this.combatSessions.get(roomId);
        if (session) this.clearCombatSessionTimers(session);
        server.in(roomId).socketsLeave(roomId);
        this.combatSessions.delete(roomId);
    }
}
