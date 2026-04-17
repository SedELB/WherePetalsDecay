import { Injectable, effect } from '@angular/core';
import {
    COMBAT_END_POPUP_DURATION_MS,
    COMBAT_MAP_LAYOUT,
    DICE_RESULT_DISPLAY_MS,
    DICE_ROLL_DURATION_MS,
    POSTURE_BONUS,
} from '@app/components/combat/combat.constants';
import {
    CombatEndPopupData,
    CombatSequenceDeps,
    FighterSide,
    FighterStatType,
    RoundDetailedResult,
    RoundPhaseStep,
    RoundResolutionSequenceParams,
    TypePosture,
} from '@app/interfaces/combat.interfaces';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { Posture } from '@common/character';
import { PostureType } from '@common/enums';
import { CombatFighterResult, CombatResult, CombatRoundTimelineData } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { CombatAnimationService } from './combat-animation.service';
import { CombatDiceService } from './combat-dice.service';
import * as utils from './combat-logic.utils';
import * as seqHelper from './combat-sequence.helper';
import { CombatStateService } from './combat-state.service';
import { CombatUiService } from './combat-ui.service';

@Injectable()
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
        const displayed = this.getDisplayedLife(side);
        const max = this.getOriginalMaxLife(side);
        return utils.getLifeProgressPercent(displayed, max);
    }

    getOriginalMaxLife(side: FighterSide): number {
        const fighter = side === 'player' ? this.state.player() : this.state.enemy();
        return utils.getOriginalMaxLife(fighter);
    }

    getStatTotal(side: FighterSide, stat: FighterStatType): number {
        const fighter = side === 'player' ? this.state.player() : this.state.enemy();
        return utils.getStatTotal(side, stat, fighter, this.state.roundResult(), POSTURE_BONUS);
    }

    getPostureBonus(side: FighterSide, stat: FighterStatType): number {
        const fighter = side === 'player' ? this.state.player() : this.state.enemy();
        return utils.getPostureBonus(side, stat, fighter, this.state.roundResult(), POSTURE_BONUS);
    }

    getIceDebuff(side: FighterSide, stat: FighterStatType): number {
        const fighter = side === 'player' ? this.state.player() : this.state.enemy();
        return utils.getIceDebuff(side, stat, fighter, this.state.roundResult());
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
        if (type && type !== this.state.lastAppliedResultKey()) {
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

        const roundData = utils.calculateRoundLifeResults(result, player.socketId);
        this.state.rollCount.update((c) => c + 1);
        this.state.pendingLifeBySide.set({ player: roundData.playerLife, enemy: roundData.enemyLife });
        this.state.roundDamageByAttackerSocket.set({
            [player.socketId]: roundData.playerDamage,
            [enemy.socketId]: roundData.enemyDamage,
        });

        const mappedRes: RoundDetailedResult = {
            player: this.mapFighterResult(roundData.local),
            enemy: this.mapFighterResult(roundData.remote),
            rollIndex: this.state.rollCount(),
        };

        this.runRoundResolutionSequence({
            sequenceToken: this.state.createSequenceToken(),
            roundResult: mappedRes,
            damageDealt: roundData.playerDamage,
            damageReceived: roundData.enemyDamage,
            roundIndex: this.state.rollCount(),
            timeline,
            debugDiceMode: debug,
        });
    }

    private mapFighterResult(f: CombatFighterResult) {
        return utils.mapFighterResult(f);
    }

    private runRoundResolutionSequence(params: RoundResolutionSequenceParams): void {
        this.state.isRoundSequenceInProgress.set(true);
        const durations = { rollMs: DICE_ROLL_DURATION_MS, resultMs: DICE_RESULT_DISPLAY_MS };
        this.dice.playDiceAnimation(params.sequenceToken, params.roundResult, durations, params.debugDiceMode, () => {
            this.state.roundResult.set(params.roundResult);
            const deps = { state: this.state, animation: this.animation, ui: this.ui, gameViewService: this.gameViewService };
            const steps = seqHelper.buildRoundSteps(deps, params, (t) => this.finish(t), () => this.finalizeLives());
            this.runRoundPhasePipeline(params.sequenceToken, steps);
        });
    }

    private finalizeLives(): void {
        const pending = this.state.pendingLifeBySide();
        if (pending) {
            this.state.displayedLifeBySide.set(pending);
            seqHelper.syncCombatLivesToLobby({ state: this.state, gameViewService: this.gameViewService } as CombatSequenceDeps, pending);
            this.state.pendingLifeBySide.set(null);
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
        return seqHelper.shouldDelayCombatEndPopup(
            { state: this.state, gameViewService: this.gameViewService } as CombatSequenceDeps,
            this.state.lastAppliedResultKey(),
        );
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
        return utils.getDiceBonus(side, stat, this.state.roundResult());
    }

    getIceDebuffDisplay(side: FighterSide, stat: FighterStatType): string {
        return `-${this.getIceDebuff(side, stat)}`;
    }

    getPostureStatusValue(fighter: Player): string {
        return utils.getPostureStatusValue(fighter);
    }

    shouldShowAttackAnnouncement(): boolean {
        return this.state.isAttackAnimationInProgress() && !!this.state.currentAttackerSocketId();
    }

    getAttackAnnouncementMessage(): string {
        return `${this.getFighterName(this.state.currentAttackerSocketId())} avance...`;
    }

    getFighterName(id: string | null): string {
        return utils.getFighterName(id, this.state.player(), this.state.enemy());
    }

    shouldShowPosturePanel(): boolean {
        return this.state.isChoosingPosture() && this.isPostureCountdownVisible() && !this.state.isRoundSequenceInProgress();
    }

    getPostureCountdownProgressPercent(): number {
        const max = this.gameViewService.combatPostureCountdownMax();
        return utils.getLifeProgressPercent(this.getPostureCountdown(), max);
    }
}
