/* eslint-disable max-lines */
import { Injectable, effect } from '@angular/core';
import {
    COMBAT_END_POPUP_DURATION_MS,
    COMBAT_MAP_LAYOUT,
    DAMAGE_POPUP_DURATION_MS,
    DICE_RESULT_DISPLAY_MS,
    DICE_ROLL_DURATION_MS,
    FIGHTER_IMPACT_DELAY_MS,
    FIGHTER_MOVEMENT_DURATION_MS,
    POSTURE_BONUS,
    ROUND_ANNOUNCEMENT_DURATION_MS,
    ROUND_PHASE_DELAY_MS,
    TO_PERCENT,
} from '@app/components/combat/combat.constants';
import {
    CombatEndPopupData,
    FighterSide,
    FighterStatType,
    RoundDetailedResult,
    RoundPhaseStep,
    RoundResolutionSequenceParams,
    TypePosture,
} from '@app/interfaces/combat.interfaces';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { Posture } from '@common/character';
import { BASE_STATS } from '@common/constants/character.constants';
import { PostureType } from '@common/enums';
import { CombatFighterResult, CombatResult, CombatRoundTimelineData } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { CombatAnimationService } from './combat-animation.service';
import { CombatDiceService } from './combat-dice.service';
import { CombatStateService } from './combat-state.service';
import { CombatUiService } from './combat-ui.service';

@Injectable() // Note: providedIn is handled by component providers if needed, or root
export class CombatLogicService {
    private combatEndPopupTimeout: ReturnType<typeof setTimeout> | null = null;
    private deferredCombatEndPopup: CombatEndPopupData | null = null;

    constructor(
        private readonly gameViewService: GameViewService,
        private readonly state: CombatStateService,
        private readonly animation: CombatAnimationService,
        private readonly ui: CombatUiService,
        private readonly dice: CombatDiceService,
    ) {
        effect(() => {
            const popup = this.gameViewService.combatEndPopup();
            if (popup) this.handleCombatEndPopupRequest(popup);
        });
    }

    readonly playerPos = this.state.playerPos;
    readonly combatStartPopup = this.ui.combatStartPopup;
    readonly combatEndPopup = this.ui.combatEndPopup;
    readonly roundAnnouncementPopup = this.ui.roundAnnouncementPopup;
    readonly damagePopup = this.ui.damagePopup;
    readonly diceRollDisplay = this.dice.diceRollDisplay;
    readonly impactDamagePopups = this.ui.impactDamagePopups;
    readonly isChoosingPosture = this.state.isChoosingPosture;
    readonly isRoundSequenceInProgress = this.state.isRoundSequenceInProgress;
    readonly combatMap = COMBAT_MAP_LAYOUT;

    initialize(): void {
        this.state.isChoosingPosture.set(true);
    }

    dispose(): void {
        this.clearCombatEndPopupTimeout();
        this.deferredCombatEndPopup = null;
        this.animation.clearMovementAnimationFrame();
        this.ui.clearAll();
        this.dice.clearAnimations();
        this.state.reset();
    }

    dismissCombatEndPopup(): void {
        this.closeCombatEndPopup();
    }

    setCombatants(player: Player, enemy: Player): void {
        this.state.player.set(player);
        this.state.enemy.set(enemy);
    }

    syncStateWithInputs(): void {
        const player = this.state.player();
        const enemy = this.state.enemy();
        if (!player?.socketId || !enemy?.socketId) return;

        this.initializeDuelIfNeeded(player, enemy);
        this.applyLatestServerResult();

        if (!this.state.isRoundSequenceInProgress() && !this.state.pendingLifeBySide() && !this.hasDeadFighter()) {
            this.syncDisplayedLives();
        }

        this.state.isChoosingPosture.set(!this.hasChosenPosture(player));
        this.handleEnemyPostureNotification(enemy);
    }

    choosePosture(posture: TypePosture): void {
        const player = this.state.player();
        if (!this.state.isChoosingPosture() || !posture || !this.isPostureCountdownVisible() || !player?.character) return;

        player.character.bonusPosture = { type: posture, bonus: POSTURE_BONUS };
        this.state.isChoosingPosture.set(false);
        this.ui.showToast(`Posture ${posture === PostureType.Attack ? 'offensive' : 'défensive'} choisie.`, 'success');

        const lobbyId = this.gameViewService.gameLobby()?.lobbyId;
        const roomId = this.gameViewService.getCurrentCombatRoomId();
        if (lobbyId && roomId) {
            this.gameViewService.sendPostureChoice(lobbyId, roomId, player.character.bonusPosture as Posture);
        }
    }

    readonly getCurrentRoundIndex = (): number => this.gameViewService.combatRoundIndex();
    readonly getPostureCountdown = (): number => (this.hasDeadFighter() ? 0 : this.gameViewService.combatPostureCountdown());
    readonly isPostureCountdownVisible = (): boolean => this.getPostureCountdown() > 0 && !this.gameViewService.isCombatRoundTransitioning();
    readonly isPosturePending = (f: Player): boolean => !f?.character?.bonusPosture?.type && this.isPostureCountdownVisible();
    readonly hasDeadFighter = (): boolean => this.isFighterDead('player') || this.isFighterDead('enemy');
    readonly isFighterDead = (side: FighterSide): boolean => this.state.displayedLifeBySide()[side] <= 0;
    readonly getDisplayedLife = (side: FighterSide): number => Math.max(0, this.state.displayedLifeBySide()[side]);
    getLifeProgressPercent(side: FighterSide): number {
        const max = this.getOriginalMaxLife(side);
        return max > 0 ? (this.getDisplayedLife(side) / max) * TO_PERCENT : 0;
    }

    getOriginalMaxLife(side: FighterSide): number {
        const fighter = side === 'player' ? this.state.player() : this.state.enemy();
        return fighter?.character ? BASE_STATS.life + (fighter.character.lifeBonus ? BASE_STATS.bonus : 0) : BASE_STATS.life;
    }

    getStatTotal(side: FighterSide, stat: FighterStatType): number {
        const result = this.getStatFromResult(side, stat);
        if (result) return result.total;
        const fighter = side === 'player' ? this.state.player() : this.state.enemy();
        const base = stat === 'attack' ? fighter?.character?.attack : fighter?.character?.defense;
        return (base ?? 0) + this.getPostureBonus(side, stat) - this.getIceDebuff(side, stat);
    }

    getPostureBonus(side: FighterSide, stat: FighterStatType): number {
        const result = this.getStatFromResult(side, stat);
        if (result) return result.postureBonus;
        const type = (side === 'player' ? this.state.player() : this.state.enemy())?.character?.bonusPosture?.type;
        return (stat === 'attack' && type === PostureType.Attack) || (stat === 'defense' && type === PostureType.Defense) ? POSTURE_BONUS : 0;
    }

    getIceDebuff(side: FighterSide, stat: FighterStatType): number {
        const result = this.getStatFromResult(side, stat);
        if (result) return result.penalty;
        return (side === 'player' ? this.state.player() : this.state.enemy())?.character?.debuf ?? 0;
    }

    private getStatFromResult(side: FighterSide, stat: FighterStatType) {
        const res = this.state.roundResult();
        const fRes = side === 'player' ? res?.player : res?.enemy;
        return stat === 'attack' ? fRes?.attack : fRes?.defense;
    }

    private syncDisplayedLives(): void {
        const p = this.state.player();
        const e = this.state.enemy();
        if (p && e) {
            this.state.displayedLifeBySide.set({
                player: Math.max(0, p.character.life),
                enemy: Math.max(0, e.character.life),
            });
        }
    }

    private initializeDuelIfNeeded(player: Player, enemy: Player): void {
        const key = `${player.socketId}:${enemy.socketId}`;
        if (key === this.state.duelKey()) return;

        this.state.reset();
        this.state.duelKey.set(key);
        this.state.displayedLifeBySide.set({
            player: Math.max(0, player.character.life),
            enemy: Math.max(0, enemy.character.life),
        });
        this.state.playerPos.set({ [player.socketId]: { x: 1, y: 2 }, [enemy.socketId]: { x: 1, y: 0 } });
        this.ui.showCombatStartPopup(this.gameViewService.combatInitiatorName() || player.character.name);
    }

    private handleEnemyPostureNotification(enemy: Player): void {
        const type = enemy.character.bonusPosture?.type;
        if (type && type !== this.state.lastAppliedResultKey()) { // Simple hack to check posture change
            // Logic for posture toast if needed
        }
    }

    private hasChosenPosture(p: Player): boolean {
        return !!p.character.bonusPosture?.type;
    }

    private applyLatestServerResult(): void {
        const res = this.gameViewService.lastCombatRoundResolved();
        if (!res || res.roomId !== this.gameViewService.getCurrentCombatRoomId()) return;

        const key = `${res.roundIndex}:${res.resolvedAtEpochMs}`;
        if (key === this.state.lastAppliedResultKey() || key === this.state.pendingRoundResult()?.resultKey) return;

        if (this.state.isRoundSequenceInProgress()) {
            this.state.pendingRoundResult.set({
                result: res.result,
                resultKey: key,
                timeline: res.timeline ?? null,
                debugDiceMode: !!res.debugDiceMode,
            });
            return;
        }

        this.applyRoundResult(res.result, key, res.timeline ?? null, !!res.debugDiceMode);
    }

    private applyRoundResult(result: CombatResult, resultKey: string, timeline: CombatRoundTimelineData | null, debug: boolean): void {
        this.state.lastAppliedResultKey.set(resultKey);
        const player = this.state.player();
        const enemy = this.state.enemy();
        if (!player || !enemy) return;

        const localIsAtk = result.attacker.socketId === player.socketId;
        const local = localIsAtk ? result.attacker : result.defender;
        const remote = localIsAtk ? result.defender : result.attacker;
        const displayedPlayerLife = local.killed ? 0 : Math.max(0, local.lifeAfter);
        const displayedEnemyLife = remote.killed ? 0 : Math.max(0, remote.lifeAfter);

        this.state.rollCount.update((c) => c + 1);
        this.state.pendingLifeBySide.set({ player: displayedPlayerLife, enemy: displayedEnemyLife });
        this.state.roundDamageByAttackerSocket.set({
            [player.socketId]: local.damageDealt,
            [enemy.socketId]: remote.damageDealt,
        });

        const mappedRes: RoundDetailedResult = {
            player: this.mapFighterResult(local),
            enemy: this.mapFighterResult(remote),
            rollIndex: this.state.rollCount(),
        };

        this.runRoundResolutionSequence({
            sequenceToken: this.state.createSequenceToken(),
            roundResult: mappedRes,
            damageDealt: local.damageDealt,
            damageReceived: remote.damageDealt,
            roundIndex: this.state.rollCount(),
            timeline,
            debugDiceMode: debug,
        });
    }

    private mapFighterResult(f: CombatFighterResult) {
        return {
            attack: {
                base: f.attack.base, postureBonus: f.attack.postureBonus,
                dice: f.attack.diceBonus, penalty: f.attack.penalty, total: f.attack.total,
            },
            defense: {
                base: f.defense.base, postureBonus: f.defense.postureBonus,
                dice: f.defense.diceBonus, penalty: f.defense.penalty, total: f.defense.total,
            },
        };
    }

    private runRoundResolutionSequence(params: RoundResolutionSequenceParams): void {
        this.state.isRoundSequenceInProgress.set(true);
        const durations = { rollMs: DICE_ROLL_DURATION_MS, resultMs: DICE_RESULT_DISPLAY_MS };
        this.dice.playDiceAnimation(params.sequenceToken, params.roundResult, durations, params.debugDiceMode, () => {
            this.state.roundResult.set(params.roundResult);
            this.runRoundPhasePipeline(params.sequenceToken, this.buildSteps(params));
        });
    }

    private buildSteps(params: RoundResolutionSequenceParams): RoundPhaseStep[] {
        const playerId = this.state.player()?.socketId ?? '';
        const enemyId = this.state.enemy()?.socketId ?? '';
        return [
            { delayMs: ROUND_PHASE_DELAY_MS, action: (next) => this.animateMovement(params.sequenceToken, playerId, enemyId, next) },
            { delayMs: ROUND_PHASE_DELAY_MS, action: (next) => this.animateMovement(params.sequenceToken, enemyId, playerId, next) },
            {
                delayMs: 0, action: (next) => {
                    this.finalizeLives(); next();
                },
            },
            {
                delayMs: ROUND_PHASE_DELAY_MS, action: (next) => {
                    this.ui.showDamagePopup(params.damageDealt, params.damageReceived, params.roundIndex);
                    next();
                },
            },
            {
                delayMs: DAMAGE_POPUP_DURATION_MS, action: (next) => {
                    this.ui.damagePopup.set(null); next();
                },
            },
            {
                delayMs: 0, action: (next) => {
                    if (this.hasDeadFighter()) return this.finish(params.sequenceToken);
                    this.ui.showRoundAnnouncement(params.roundIndex + 1);
                    next();
                },
            },
            {
                delayMs: ROUND_ANNOUNCEMENT_DURATION_MS, action: () => {
                    this.ui.roundAnnouncementPopup.set(null);
                    this.finish(params.sequenceToken);
                },
            },
        ];
    }

    private animateMovement(token: number, atkId: string, defId: string, next: () => void): void {
        const player = this.state.player();
        const enemy = this.state.enemy();
        if (!player || !enemy) return next();

        const base: Record<string, { x: number; y: number }> = {
            [player.socketId]: { x: 1, y: 2 },
            [enemy.socketId]: { x: 1, y: 0 },
        };
        const lunge = { x: base[atkId].x, y: base[atkId].y + (atkId === player.socketId ? -1 : 1) };
        this.state.currentAttackerSocketId.set(atkId);
        this.state.isAttackAnimationInProgress.set(true);
        this.animation.animateFighterPosition({
            sequenceToken: token, fighterSocketId: atkId,
            from: base[atkId], to: lunge, durationMs: FIGHTER_MOVEMENT_DURATION_MS,
            onComplete: () => {
                const damage = this.state.roundDamageByAttackerSocket()[atkId];
                this.ui.spawnImpactDamagePopup(defId, damage, { rows: 3, cols: 3 });
                setTimeout(() => {
                    this.animation.animateFighterPosition({
                        sequenceToken: token, fighterSocketId: atkId,
                        from: lunge, to: base[atkId], durationMs: FIGHTER_MOVEMENT_DURATION_MS,
                        onComplete: () => {
                            this.state.isAttackAnimationInProgress.set(false);
                            this.state.currentAttackerSocketId.set(null);
                            next();
                        },
                    });
                }, FIGHTER_IMPACT_DELAY_MS);
            },
        });
    }

    private finalizeLives(): void {
        const pending = this.state.pendingLifeBySide();
        if (pending) {
            this.state.displayedLifeBySide.set(pending); this.state.pendingLifeBySide.set(null);
        }
    }

    private finish(token: number): void {
        if (this.state.activeRoundSequenceToken() !== token) return;
        this.state.isRoundSequenceInProgress.set(false);
        this.applyPendingRoundResult();
        this.tryShowDeferredCombatEndPopup();
    }

    private applyPendingRoundResult(): void {
        const pending = this.state.pendingRoundResult();
        if (!pending) return;
        this.state.pendingRoundResult.set(null);
        this.applyRoundResult(pending.result, pending.resultKey, pending.timeline, pending.debugDiceMode);
    }

    private runRoundPhasePipeline(token: number, steps: RoundPhaseStep[]): void {
        if (steps.length === 0) return;
        const [current, ...rest] = steps;
        setTimeout(() => {
            if (this.state.activeRoundSequenceToken() === token) current.action(() => this.runRoundPhasePipeline(token, rest));
        }, current.delayMs);
    }

    private handleCombatEndPopupRequest(popup: CombatEndPopupData): void {
        this.deferredCombatEndPopup = popup;
        this.tryShowDeferredCombatEndPopup();
    }

    private tryShowDeferredCombatEndPopup(): void {
        if (!this.deferredCombatEndPopup || this.shouldDelayCombatEndPopup()) return;

        const popup = this.deferredCombatEndPopup;
        this.deferredCombatEndPopup = null;
        this.clearCombatEndPopupTimeout();
        this.ui.showCombatEndPopup(popup);
        this.combatEndPopupTimeout = setTimeout(() => {
            this.closeCombatEndPopup();
        }, COMBAT_END_POPUP_DURATION_MS);
    }

    private shouldDelayCombatEndPopup(): boolean {
        if (this.state.isRoundSequenceInProgress()) return true;

        const latestResolvedRound = this.gameViewService.lastCombatRoundResolved();
        const roomId = this.gameViewService.getCurrentCombatRoomId();
        if (!latestResolvedRound || latestResolvedRound.roomId !== roomId) return false;

        const latestResolvedRoundKey = `${latestResolvedRound.roundIndex}:${latestResolvedRound.resolvedAtEpochMs}`;
        return latestResolvedRoundKey !== this.state.lastAppliedResultKey();
    }

    private closeCombatEndPopup(): void {
        this.clearCombatEndPopupTimeout();
        this.deferredCombatEndPopup = null;
        this.ui.combatEndPopup.set(null);
        this.gameViewService.completeCombatOverlay();
    }

    private clearCombatEndPopupTimeout(): void {
        if (!this.combatEndPopupTimeout) return;
        clearTimeout(this.combatEndPopupTimeout);
        this.combatEndPopupTimeout = null;
    }

    getDiceBonusDisplay(side: FighterSide, stat: FighterStatType): string {
        return `+${this.getDiceBonus(side, stat)}`;
    }
    getDiceBonus(side: FighterSide, stat: FighterStatType): number {
        return this.getStatFromResult(side, stat)?.dice ?? 0;
    }
    getIceDebuffDisplay(side: FighterSide, stat: FighterStatType): string {
        return `-${this.getIceDebuff(side, stat)}`;
    }
    getPostureStatusValue(fighter: Player): string {
        const type = fighter?.character?.bonusPosture?.type;
        return type === PostureType.Attack ? '⚔️ Offensive' : type === PostureType.Defense ? '🛡️ Défensive' : '⏳ Neutre';
    }
    shouldShowAttackAnnouncement(): boolean {
        return this.state.isAttackAnimationInProgress() && !!this.state.currentAttackerSocketId();
    }
    getAttackAnnouncementMessage(): string {
        return `${this.getFighterName(this.state.currentAttackerSocketId())} avance...`;
    }
    getFighterName(id: string | null): string {
        if (!id) return 'Joueur';
        const fighter = id === this.state.player()?.socketId ? this.state.player() : this.state.enemy();
        return fighter?.character?.name ?? 'Joueur';
    }
    shouldShowPosturePanel(): boolean {
        return this.state.isChoosingPosture() && this.isPostureCountdownVisible() && !this.state.isRoundSequenceInProgress();
    }
    getPostureCountdownProgressPercent(): number {
        const max = this.gameViewService.combatPostureCountdownMax();
        return max > 0 ? (this.getPostureCountdown() / max) * TO_PERCENT : 0;
    }
}
