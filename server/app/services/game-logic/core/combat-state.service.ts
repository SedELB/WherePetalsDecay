import { CombatSession } from '@app/interfaces/combat.interface';
import { Posture } from '@common/character';
import { DEFAULT_POSTURE } from '@common/constants/combat-timeline.constants';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CombatStateService {
    private fightCounter = 0;
    private readonly combatSessions = new Map<string, CombatSession>();
    private readonly pendingPostCombatTurnResumes = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(private readonly logger: Logger) {}

    incrementFightCounter(): number {
        this.fightCounter += 1;
        return this.fightCounter;
    }

    hasActiveCombatInLobby(lobbyId: string): boolean {
        return Array.from(this.combatSessions.values()).some((session) => session.lobbyId === lobbyId);
    }

    findCombatSessionByPlayer(socketId: string): CombatSession | undefined {
        return Array.from(this.combatSessions.values()).find((session) => session.attackerId === socketId || session.defenderId === socketId);
    }

    getSession(roomId: string): CombatSession | undefined {
        return this.combatSessions.get(roomId);
    }

    createSession(roomId: string, session: CombatSession): void {
        this.combatSessions.set(roomId, session);
    }

    deleteSession(roomId: string): void {
        this.combatSessions.delete(roomId);
    }

    clearSessionTimers(session: CombatSession): void {
        if (session.timeoutHandle) clearTimeout(session.timeoutHandle);
        if (session.countdownHandle) clearInterval(session.countdownHandle);
    }

    normalizePosture(posture: Posture): Posture {
        return {
            type: posture.type ?? DEFAULT_POSTURE.type,
            bonus: posture.bonus ?? DEFAULT_POSTURE.bonus,
        };
    }

    schedulePostCombatTurnResume(lobbyId: string, delay: number, callback: () => void): void {
        this.clearPendingPostCombatTurnResume(lobbyId);
        const handle = setTimeout(callback, delay);
        this.pendingPostCombatTurnResumes.set(lobbyId, handle);
    }

    clearPendingPostCombatTurnResume(lobbyId: string): void {
        const handle = this.pendingPostCombatTurnResumes.get(lobbyId);
        if (handle) {
            clearTimeout(handle);
            this.pendingPostCombatTurnResumes.delete(lobbyId);
        }
    }
}
