import { Injectable, signal } from '@angular/core';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { LifeBySide, RoundDetailedResult, PendingRoundResult } from '@app/interfaces/combat.interfaces';

@Injectable({
    providedIn: 'root',
})
export class CombatStateService {
    readonly player = signal<Player | null>(null);
    readonly enemy = signal<Player | null>(null);
    readonly playerPos = signal<Record<string, Vec2>>({});
    readonly displayedLifeBySide = signal<LifeBySide>({ player: 0, enemy: 0 });
    readonly duelKey = signal<string>('');
    readonly rollCount = signal<number>(0);
    readonly activeRoundSequenceToken = signal<number>(0);
    readonly currentAttackerSocketId = signal<string | null>(null);
    
    readonly roundResult = signal<RoundDetailedResult | null>(null);
    readonly lastAppliedResultKey = signal<string>('');
    readonly pendingRoundResult = signal<PendingRoundResult | null>(null);
    readonly pendingLifeBySide = signal<LifeBySide | null>(null);
    readonly roundDamageByAttackerSocket = signal<Record<string, number>>({});

    readonly isRoundSequenceInProgress = signal<boolean>(false);
    readonly isAttackAnimationInProgress = signal<boolean>(false);
    readonly isDiceRollInProgress = signal<boolean>(false);
    readonly isChoosingPosture = signal<boolean>(false);

    reset(): void {
        this.displayedLifeBySide.set({ player: 0, enemy: 0 });
        this.duelKey.set('');
        this.rollCount.set(0);
        this.roundResult.set(null);
        this.currentAttackerSocketId.set(null);
        this.pendingRoundResult.set(null);
        this.pendingLifeBySide.set(null);
        this.roundDamageByAttackerSocket.set({});
        this.lastAppliedResultKey.set('');
        this.isRoundSequenceInProgress.set(false);
        this.isAttackAnimationInProgress.set(false);
        this.isDiceRollInProgress.set(false);
        this.isChoosingPosture.set(false);
    }

    createSequenceToken(): number {
        const nextToken = this.activeRoundSequenceToken() + 1;
        this.activeRoundSequenceToken.set(nextToken);
        return nextToken;
    }
}
