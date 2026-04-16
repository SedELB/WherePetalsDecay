import { Injectable, signal } from '@angular/core';
import {
    COMBAT_TOAST_DEFAULT_DURATION_MS,
    IMPACT_POPUP_DURATION_MS,
    IMPACT_POPUP_ENEMY_TILT_DEG,
    IMPACT_POPUP_MAX_PERCENT,
    IMPACT_POPUP_MIN_PERCENT,
    IMPACT_POPUP_PLAYER_TILT_DEG,
} from '@app/components/combat/combat.constants';
import {
    CombatStartPopupData,
    DamagePopupData,
    GridDimensions,
    ImpactDamagePopupData,
    RoundAnnouncementPopupData,
} from '@app/interfaces/combat.interfaces';
import { COMBAT_START_POPUP_DISPLAY_DURATION_MS } from '@common/constants/combat-timeline.constants';
import swal from 'sweetalert2';
import { CombatAnimationService } from './combat-animation.service';
import { CombatStateService } from './combat-state.service';

@Injectable({
    providedIn: 'root',
})
export class CombatUiService {
    readonly combatStartPopup = signal<CombatStartPopupData | null>(null);
    readonly combatEndPopup = signal<CombatStartPopupData | null>(null);
    readonly roundAnnouncementPopup = signal<RoundAnnouncementPopupData | null>(null);
    readonly damagePopup = signal<DamagePopupData | null>(null);
    readonly impactDamagePopups = signal<ImpactDamagePopupData[]>([]);

    private impactDamagePopupIdCounter = 0;
    private impactDamagePopupTimeouts: ReturnType<typeof setTimeout>[] = [];

    constructor(
        private readonly combatState: CombatStateService,
        private readonly combatAnimation: CombatAnimationService,
    ) {}

    showCombatStartPopup(initiatorName: string): void {
        this.combatStartPopup.set({
            title: 'Combat lancé',
            message: `${initiatorName} a initié le combat. Préparez votre posture.`,
        });
        setTimeout(() => this.combatStartPopup.set(null), COMBAT_START_POPUP_DISPLAY_DURATION_MS);
    }

    showRoundAnnouncement(roundIndex: number): void {
        this.roundAnnouncementPopup.set({
            roundIndex,
            message: `Tour ${roundIndex} dans un instant...`,
        });
    }

    showDamagePopup(damageDealt: number, damageReceived: number, rollIndex: number): void {
        this.damagePopup.set({ damageDealt, damageReceived, rollIndex });
    }

    showCombatEndPopup(popup: CombatStartPopupData): void {
        this.combatEndPopup.set(popup);
    }

    spawnImpactDamagePopup(targetSocketId: string, damage: number, gridDimensions: GridDimensions): void {
        const targetPosition = this.combatState.playerPos()[targetSocketId];
        if (!targetPosition) return;

        const projectedPosition = this.combatAnimation.projectImpactPopupPosition(targetPosition, gridDimensions);
        const popupId = ++this.impactDamagePopupIdCounter;
        const targetIsPlayer = targetSocketId === this.combatState.player()?.socketId;
        const normalizedDamage = Math.max(damage, 0);

        const popup: ImpactDamagePopupData = {
            id: popupId,
            text: `-${normalizedDamage}`,
            isZeroDamage: normalizedDamage === 0,
            leftPercent: this.clamp(projectedPosition.leftPercent, IMPACT_POPUP_MIN_PERCENT, IMPACT_POPUP_MAX_PERCENT),
            topPercent: this.clamp(projectedPosition.topPercent, IMPACT_POPUP_MIN_PERCENT, IMPACT_POPUP_MAX_PERCENT),
            tiltDeg: targetIsPlayer ? IMPACT_POPUP_PLAYER_TILT_DEG : IMPACT_POPUP_ENEMY_TILT_DEG,
        };

        this.impactDamagePopups.update((popups) => [...popups, popup]);

        const timeout = setTimeout(() => {
            this.impactDamagePopups.update((popups) => popups.filter((p) => p.id !== popupId));
            this.impactDamagePopupTimeouts = this.impactDamagePopupTimeouts.filter((t) => t !== timeout);
        }, IMPACT_POPUP_DURATION_MS);

        this.impactDamagePopupTimeouts.push(timeout);
    }

    showToast(
        title: string,
        icon: 'success' | 'info' | 'warning',
        html?: string,
        timer = COMBAT_TOAST_DEFAULT_DURATION_MS,
    ): void {
        void swal.fire({
            toast: true,
            position: 'bottom-end',
            icon,
            title,
            html,
            showConfirmButton: false,
            timer,
            timerProgressBar: true,
        });
    }

    clearAll(): void {
        this.combatStartPopup.set(null);
        this.combatEndPopup.set(null);
        this.roundAnnouncementPopup.set(null);
        this.damagePopup.set(null);
        this.impactDamagePopups.set([]);
        this.impactDamagePopupTimeouts.forEach(clearTimeout);
        this.impactDamagePopupTimeouts = [];
    }

    private clamp(val: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, val));
    }
}
