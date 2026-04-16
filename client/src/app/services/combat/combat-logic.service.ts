/* eslint-disable max-lines */
import { Injectable, effect } from '@angular/core';
import {
    COMBAT_TOAST_DEFAULT_DURATION_MS,
    DEFAULT_DICE_FACES,
    DICE_ROLL_TICK_MS,
    EASE_ACCELERATION_FACTOR,
    EASE_DECELERATION_FACTOR,
    EASE_DECELERATION_OFFSET,
    EASE_DIVISOR,
    EASE_POWER,
    EASE_PROGRESS_MIDDLE_POINT,
    IMPACT_POPUP_DEFAULT_GRID_DIMENSION,
    IMPACT_POPUP_DURATION_MS,
    IMPACT_POPUP_ENEMY_TILT_DEG,
    IMPACT_POPUP_MAX_PERCENT,
    IMPACT_POPUP_MIN_PERCENT,
    IMPACT_POPUP_PLAYER_TILT_DEG,
    IMPACT_POPUP_TILE_CENTER_OFFSET,
    IMPACT_POPUP_VERTICAL_OFFSET_PERCENT,
    POSTURE_BONUS,
    TO_PERCENT,
} from '@app/components/combat/combat.constants';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { Posture } from '@common/character';
import { BASE_STATS } from '@common/constants/character.constants';
import {
    COMBAT_ANIMATION_SPEED_MULTIPLIER,
    COMBAT_END_POPUP_DISPLAY_DURATION_MS,
    COMBAT_START_POPUP_DISPLAY_DURATION_MS,
    DAMAGE_DISPLAY_DURATION_MS,
    DICE_RESULT_DISPLAY_DURATION_MS,
    DICE_ROLL_DURATION_MS,
    FIGHTER_ADVANCE_DURATION_MS,
    FIGHTER_HOLD_DURATION_MS,
    FIGHTER_RETREAT_DURATION_MS,
    NEXT_ROUND_ANNOUNCEMENT_DURATION_MS,
    POSTURE_RESULT_DISPLAY_DURATION_MS,
    ROUND_PHASE_BUFFER_MS,
    STATUS_BUFFER_DURATION_MS,
} from '@common/constants/combat-timeline.constants';
import { TileTexture } from '@common/enums';
import { CombatResult, CombatRoundTimelineData } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';

export type TypePosture = 'atk' | 'def' | null;
export type FighterSide = 'player' | 'enemy';
export type FighterStatType = 'attack' | 'defense';

interface DetailedStatLine { base: number; postureBonus: number; dice: number; penalty: number; total: number; }
interface FighterDetailedResult { attack: DetailedStatLine; defense: DetailedStatLine; }
interface RoundDetailedResult { player: FighterDetailedResult; enemy: FighterDetailedResult; rollIndex: number; }
interface DamagePopupData { damageDealt: number; damageReceived: number; rollIndex: number; }
interface CombatStartPopupData { title: string; message: string; }
interface PendingRoundResult {
    result: CombatResult;
    resultKey: string;
    timeline: CombatRoundTimelineData | null;
    debugDiceMode: boolean;
}
interface RoundAnnouncementPopupData { roundIndex: number; message: string; }
interface ImpactDamagePopupData {
    id: number;
    text: string;
    leftPercent: number;
    topPercent: number;
    tiltDeg: number;
}
type LifeBySide = Record<FighterSide, number>;
interface FighterDiceDisplayData {
    fighterName: string;
    attackFaces: number;
    defenseFaces: number;
    attackValue: number;
    defenseValue: number;
}
interface DiceRollDisplayData {
    player: FighterDiceDisplayData;
    enemy: FighterDiceDisplayData;
    isFinal: boolean;
}
interface FighterPositionAnimationParams {
    sequenceToken: number;
    fighterSocketId: string;
    from: Vec2;
    to: Vec2;
    durationMs: number;
    onComplete: () => void;
}
interface FighterMovementPhaseParams {
    sequenceToken: number;
    attackerSocketId: string;
    defenderSocketId: string;
    advanceDurationMs: number;
    holdDurationMs: number;
    retreatDurationMs: number;
    onComplete: () => void;
}
interface RoundResolutionSequenceParams {
    sequenceToken: number;
    roundResult: RoundDetailedResult;
    damageDealt: number;
    damageReceived: number;
    roundIndex: number;
    timeline: CombatRoundTimelineData | null;
    debugDiceMode: boolean;
}
type RoundPhaseAction = (next: () => void) => void;
interface RoundPhaseStep {
    delayMs: number;
    action: RoundPhaseAction;
}
interface RoundDiceAnimationParams {
    sequenceToken: number;
    roundResult: RoundDetailedResult;
    rollDurationMs: number;
    resultDurationMs: number;
    debugDiceMode: boolean;
    onFinished: () => void;
}

@Injectable()
export class CombatLogicService {
    player!: Player;
    enemy!: Player;

    playerPos: Record<string, Vec2> = {};
    isChoosingPosture = false;
    roundResult: RoundDetailedResult | null = null;
    combatStartPopup: CombatStartPopupData | null = null;
    combatEndPopup: CombatStartPopupData | null = null;
    roundAnnouncementPopup: RoundAnnouncementPopupData | null = null;
    damagePopup: DamagePopupData | null = null;
    diceRollDisplay: DiceRollDisplayData | null = null;
    impactDamagePopups: ImpactDamagePopupData[] = [];

    private duelKey = '';
    private hasShownStartPopup = false;
    private lastEnemyPostureType: TypePosture = null;
    private rollCount = 0;
    private lastAppliedResultKey = '';
    private isAttackAnimationInProgress = false;
    private isDiceRollInProgress = false;
    private isRoundSequenceInProgress = false;
    private activeRoundSequenceToken = 0;
    private currentAttackerSocketId: string | null = null;
    private pendingRoundResult: PendingRoundResult | null = null;
    private pendingCombatEndPopup: CombatStartPopupData | null = null;
    private displayedLifeBySide: LifeBySide = { player: 0, enemy: 0 };
    private pendingLifeBySide: LifeBySide | null = null;
    private roundDamageByAttackerSocket: Record<string, number> = {};
    private impactDamagePopupIdCounter = 0;
    private roundSequenceTimeouts: ReturnType<typeof setTimeout>[] = [];
    private diceRollAnimationTimeouts: ReturnType<typeof setTimeout>[] = [];
    private impactDamagePopupTimeouts: ReturnType<typeof setTimeout>[] = [];
    private movementAnimationFrameId: number | null = null;
    private diceRollInterval: ReturnType<typeof setInterval> | null = null;
    private combatStartPopupTimeout: ReturnType<typeof setTimeout> | null = null;
    private combatEndPopupTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly defaultRoundTimeline: CombatRoundTimelineData = {
        postureResultDisplayDurationMs: POSTURE_RESULT_DISPLAY_DURATION_MS,
        roundPhaseBufferMs: ROUND_PHASE_BUFFER_MS,
        diceRollDurationMs: DICE_ROLL_DURATION_MS,
        diceResultDisplayDurationMs: DICE_RESULT_DISPLAY_DURATION_MS,
        damageDisplayDurationMs: DAMAGE_DISPLAY_DURATION_MS,
        fighterAdvanceDurationMs: FIGHTER_ADVANCE_DURATION_MS,
        fighterHoldDurationMs: FIGHTER_HOLD_DURATION_MS,
        fighterRetreatDurationMs: FIGHTER_RETREAT_DURATION_MS,
        statusBufferDurationMs: STATUS_BUFFER_DURATION_MS,
        nextRoundAnnouncementDurationMs: NEXT_ROUND_ANNOUNCEMENT_DURATION_MS,
    };
    readonly combatMap: Tile[][] = [
        [{ type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }],
        [{ type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }],
        [{ type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }],
    ];

    constructor(private readonly gameViewService: GameViewService) {
        effect(() => {
            const popup = this.gameViewService.combatEndPopup();
            if (!popup) return;
            this.handleCombatEndPopupRequest(popup);
        });
    }

    setCombatants(player: Player, enemy: Player): void {
        this.player = player;
        this.enemy = enemy;
    }

    getCurrentRoundIndex(): number {
        return this.gameViewService.combatRoundIndex();
    }

    getPostureCountdown(): number {
        if (this.hasDeadFighter()) return 0;
        if (
            this.isRoundSequenceInProgress ||
            this.combatStartPopup ||
            this.roundAnnouncementPopup ||
            this.combatEndPopup ||
            this.pendingCombatEndPopup
        ) {
            return 0;
        }
        return this.gameViewService.combatPostureCountdown();
    }

    getPostureCountdownProgressPercent(): number {
        const countdownMax = this.gameViewService.combatPostureCountdownMax();
        if (countdownMax <= 0) return 0;

        const currentCountdown = this.getPostureCountdown();
        const progressPercent = (currentCountdown / countdownMax) * TO_PERCENT;
        return Math.min(TO_PERCENT, Math.max(0, progressPercent));
    }

    isPostureCountdownVisible(): boolean {
        return this.getPostureCountdown() > 0 && !this.gameViewService.isCombatRoundTransitioning();
    }

    shouldShowAttackAnnouncement(): boolean {
        if (this.hasDeadFighter()) return false;
        return this.isAttackAnimationInProgress && !!this.currentAttackerSocketId;
    }

    getAttackAnnouncementMessage(): string {
        return `${this.getFighterName(this.currentAttackerSocketId)} avance...`;
    }

    isPosturePending(fighter: Player): boolean {
        if (this.hasDeadFighter()) return false;
        return !fighter?.character?.bonusPosture?.type && this.isPostureCountdownVisible();
    }

    isFighterDead(side: FighterSide): boolean {
        if (!this.duelKey) return false;
        return this.displayedLifeBySide[side] <= 0;
    }

    hasDeadFighter(): boolean {
        return this.isFighterDead('player') || this.isFighterDead('enemy');
    }

    getPostureStatusValue(fighter: Player): string {
        const postureType = fighter?.character?.bonusPosture?.type;
        if (postureType === 'atk') return '⚔️ Offensive';
        if (postureType === 'def') return '🛡️ Défensive';
        return '⏳ Neutre';
    }

    getStatTotal(side: FighterSide, stat: FighterStatType): number {
        const statResult = this.getRoundStatResult(side, stat);
        if (statResult) return statResult.total;

        const fighter = this.getFighterBySide(side);
        if (!fighter?.character) return 0;

        const baseValue = stat === 'attack' ? fighter.character.attack : fighter.character.defense;
        const postureBonus = this.getPostureBonus(side, stat);
        const iceDebuff = this.getIceDebuff(side, stat);

        return Math.max(baseValue + postureBonus - iceDebuff, 0);
    }

    getPostureBonus(side: FighterSide, stat: FighterStatType): number {
        const statResult = this.getRoundStatResult(side, stat);
        if (statResult) return statResult.postureBonus;

        const postureType = this.getFighterBySide(side)?.character?.bonusPosture?.type;
        if (!postureType) return 0;
        if (stat === 'attack' && postureType === 'atk') return POSTURE_BONUS;
        if (stat === 'defense' && postureType === 'def') return POSTURE_BONUS;
        return 0;
    }

    getDiceBonus(side: FighterSide, stat: FighterStatType): number {
        const statResult = this.getRoundStatResult(side, stat);
        if (!statResult) return 0;
        return statResult.dice;
    }

    getDiceBonusDisplay(side: FighterSide, stat: FighterStatType): string {
        return `+${this.getDiceBonus(side, stat)}`;
    }

    getIceDebuff(side: FighterSide, stat: FighterStatType): number {
        const statResult = this.getRoundStatResult(side, stat);
        if (statResult) return statResult.penalty;

        const fighterDebuff = this.getFighterBySide(side)?.character?.debuf ?? 0;
        return fighterDebuff > 0 ? fighterDebuff : 0;
    }

    getIceDebuffDisplay(side: FighterSide, stat: FighterStatType): string {
        return `-${this.getIceDebuff(side, stat)}`;
    }

    getDisplayedLife(side: FighterSide): number {
        return this.displayedLifeBySide[side];
    }

    getOriginalMaxLife(side: FighterSide): number {
        const fighter = this.getFighterBySide(side);
        if (!fighter?.character) return BASE_STATS.life;
        return BASE_STATS.life + (fighter.character.lifeBonus ? BASE_STATS.bonus : 0);
    }

    getLifeProgressPercent(side: FighterSide): number {
        const maxLife = this.getOriginalMaxLife(side);
        if (maxLife <= 0) return 0;

        const progressPercent = (this.getDisplayedLife(side) / maxLife) * TO_PERCENT;
        return Math.min(TO_PERCENT, Math.max(0, progressPercent));
    }

    shouldShowPosturePanel(): boolean {
        if (this.hasDeadFighter()) return false;
        return this.isChoosingPosture && this.isPostureCountdownVisible() && !this.isRoundSequenceInProgress;
    }

    initialize(): void {
        this.isChoosingPosture = true;
    }

    dispose(): void {
        this.cancelRoundSequence();
        this.clearImpactDamagePopups();
        this.clearCombatStartPopupTimeout();
        this.clearCombatEndPopupTimeout();
    }

    syncStateWithInputs(): void {
        if (!this.player?.socketId || !this.enemy?.socketId) return;

        this.initializeDuelIfNeeded();

        this.applyLatestServerResult();

        if (!this.isRoundSequenceInProgress && !this.pendingLifeBySide && !this.hasDeadFighter()) {
            this.syncDisplayedLivesWithCurrentFighters();
        }

        this.playerPos = this.getBaseCombatPositions();

        this.isChoosingPosture = !this.hasChosenPosture(this.player);

        const enemyPostureType = this.enemy.character.bonusPosture?.type ?? null;
        if (!enemyPostureType) {
            this.lastEnemyPostureType = null;
        } else if (enemyPostureType !== this.lastEnemyPostureType) {
            this.showToast('Posture adverse reçue. Le lancé de dés est disponible.', 'info');
            this.lastEnemyPostureType = enemyPostureType;
        }

    }

    choosePosture(posture: TypePosture): void {
        if (!this.isChoosingPosture || !posture || !this.isPostureCountdownVisible() || !this.player?.character) return;

        this.player.character.bonusPosture = { type: posture, bonus: POSTURE_BONUS };
        this.isChoosingPosture = false;
        this.showToast(`Posture ${posture === 'atk' ? 'offensive' : 'défensive'} choisie.`, 'success');

        const lobbyId = this.gameViewService.gameLobby()?.lobbyId;
        const roomId = this.gameViewService.getCurrentCombatRoomId();
        if (!lobbyId || !roomId) return;

        this.gameViewService.sendPostureChoice(lobbyId, roomId, this.player.character.bonusPosture as Posture);
    }

    private initializeDuelIfNeeded(): void {
        const newKey = `${this.player.socketId}:${this.enemy.socketId}`;
        if (newKey === this.duelKey) return;

        this.duelKey = newKey;
        this.hasShownStartPopup = false;
        this.lastEnemyPostureType = this.enemy.character.bonusPosture?.type ?? null;
        this.roundResult = null;
        this.currentAttackerSocketId = null;
        this.pendingRoundResult = null;
        this.pendingCombatEndPopup = null;
        this.pendingLifeBySide = null;
        this.roundDamageByAttackerSocket = {};
        this.clearImpactDamagePopups();
        this.cancelRoundSequence();
        this.hideCombatStartPopup();
        this.hideCombatEndPopup();
        this.hideDamagePopup();
        this.rollCount = 0;
        this.lastAppliedResultKey = '';
        this.syncDisplayedLivesWithCurrentFighters();

        if (!this.hasChosenPosture(this.player)) {
            this.player.character.bonusPosture = { type: null, bonus: 0 };
        }

        this.isChoosingPosture = !this.hasChosenPosture(this.player);

        if (!this.hasShownStartPopup) {
            this.hasShownStartPopup = true;
            this.showCombatStartPopup();
        }
    }

    private hasChosenPosture(fighter: Player): boolean {
        return Boolean(fighter.character.bonusPosture?.type);
    }

    private getBaseCombatPositions(): Record<string, Vec2> {
        if (!this.enemy?.socketId || !this.player?.socketId) return {};

        return {
            [this.enemy.socketId]: { x: 1, y: 0 },
            [this.player.socketId]: { x: 1, y: 2 },
        };
    }

    private computeLungePosition(attackerPosition: Vec2, defenderPosition: Vec2): Vec2 {
        const deltaX = defenderPosition.x - attackerPosition.x;
        const deltaY = defenderPosition.y - attackerPosition.y;

        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            return {
                x: attackerPosition.x + Math.sign(deltaX),
                y: attackerPosition.y,
            };
        }

        return {
            x: attackerPosition.x,
            y: attackerPosition.y + Math.sign(deltaY),
        };
    }

    private getFighterName(socketId: string | null): string {
        if (!socketId) return 'Un joueur';
        if (socketId === this.player?.socketId) return this.player?.character?.name ?? 'Un joueur';
        if (socketId === this.enemy?.socketId) return this.enemy?.character?.name ?? 'Un joueur';
        return 'Un joueur';
    }

    private getFighterBySide(side: FighterSide): Player {
        return side === 'player' ? this.player : this.enemy;
    }

    private getRoundStatResult(side: FighterSide, stat: FighterStatType): DetailedStatLine | null {
        const fighterResult = side === 'player' ? this.roundResult?.player : this.roundResult?.enemy;
        if (!fighterResult) return null;
        return stat === 'attack' ? fighterResult.attack : fighterResult.defense;
    }

    private getRoundTimeline(timeline: CombatRoundTimelineData | null): CombatRoundTimelineData {
        const rawTimeline = { ...this.defaultRoundTimeline, ...(timeline ?? {}) };
        return {
            ...rawTimeline,
            postureResultDisplayDurationMs: this.scaleDuration(rawTimeline.postureResultDisplayDurationMs),
            roundPhaseBufferMs: this.scaleDuration(rawTimeline.roundPhaseBufferMs),
            diceRollDurationMs: this.scaleDuration(rawTimeline.diceRollDurationMs),
            diceResultDisplayDurationMs: this.scaleDuration(rawTimeline.diceResultDisplayDurationMs),
            damageDisplayDurationMs: this.scaleDuration(rawTimeline.damageDisplayDurationMs),
            fighterAdvanceDurationMs: this.scaleDuration(rawTimeline.fighterAdvanceDurationMs),
            fighterHoldDurationMs: this.scaleDuration(rawTimeline.fighterHoldDurationMs),
            fighterRetreatDurationMs: this.scaleDuration(rawTimeline.fighterRetreatDurationMs),
            statusBufferDurationMs: this.scaleDuration(rawTimeline.statusBufferDurationMs),
            nextRoundAnnouncementDurationMs: this.scaleDuration(rawTimeline.nextRoundAnnouncementDurationMs),
        };
    }

    private scaleDuration(durationMs: number): number {
        return Math.max(0, Math.round(durationMs * COMBAT_ANIMATION_SPEED_MULTIPLIER));
    }

    private clearCombatStartPopupTimeout(): void {
        if (!this.combatStartPopupTimeout) return;
        clearTimeout(this.combatStartPopupTimeout);
        this.combatStartPopupTimeout = null;
    }

    private clearCombatEndPopupTimeout(): void {
        if (!this.combatEndPopupTimeout) return;
        clearTimeout(this.combatEndPopupTimeout);
        this.combatEndPopupTimeout = null;
    }

    private clearDiceRollInterval(): void {
        if (!this.diceRollInterval) return;
        clearInterval(this.diceRollInterval);
        this.diceRollInterval = null;
    }

    private clearDiceRollTimeouts(): void {
        if (this.diceRollAnimationTimeouts.length === 0) return;
        this.diceRollAnimationTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.diceRollAnimationTimeouts = [];
    }

    private clearDiceRollAnimations(): void {
        this.clearDiceRollInterval();
        this.clearDiceRollTimeouts();
        this.isDiceRollInProgress = false;
        this.diceRollDisplay = null;
    }

    private clearImpactDamagePopupTimeouts(): void {
        if (this.impactDamagePopupTimeouts.length === 0) return;
        this.impactDamagePopupTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.impactDamagePopupTimeouts = [];
    }

    private clearImpactDamagePopups(): void {
        this.clearImpactDamagePopupTimeouts();
        this.impactDamagePopups = [];
    }

    private clearRoundSequenceTimeouts(): void {
        if (this.roundSequenceTimeouts.length === 0) return;
        this.roundSequenceTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.roundSequenceTimeouts = [];
    }

    private clearMovementAnimationFrame(): void {
        if (this.movementAnimationFrameId === null) return;
        cancelAnimationFrame(this.movementAnimationFrameId);
        this.movementAnimationFrameId = null;
    }

    private cancelRoundSequence(): void {
        this.activeRoundSequenceToken++;
        this.clearRoundSequenceTimeouts();
        this.clearDiceRollAnimations();
        this.clearImpactDamagePopups();
        this.clearMovementAnimationFrame();
        this.isRoundSequenceInProgress = false;
        this.isAttackAnimationInProgress = false;
        this.currentAttackerSocketId = null;
        this.roundAnnouncementPopup = null;
    }

    private createRoundSequenceToken(): number {
        this.activeRoundSequenceToken++;
        return this.activeRoundSequenceToken;
    }

    private isRoundSequenceTokenActive(token: number): boolean {
        return token === this.activeRoundSequenceToken;
    }

    private enqueueRoundStep(token: number, delayMs: number, callback: () => void): void {
        const timeout = setTimeout(() => {
            if (!this.isRoundSequenceTokenActive(token)) return;
            callback();
        }, delayMs);
        this.roundSequenceTimeouts.push(timeout);
    }

    private isAnySequenceActivityInProgress(): boolean {
        return this.isRoundSequenceInProgress || this.isAttackAnimationInProgress || this.isDiceRollInProgress;
    }

    private hasUnappliedLatestResultForCurrentDuel(): boolean {
        if (!this.player?.socketId || !this.enemy?.socketId) return false;

        const result = this.gameViewService.lastCombatResult();
        if (!result) return false;

        const isCurrentDuelResult =
            (result.attacker.socketId === this.player.socketId && result.defender.socketId === this.enemy.socketId) ||
            (result.attacker.socketId === this.enemy.socketId && result.defender.socketId === this.player.socketId);
        if (!isCurrentDuelResult) return false;

        const resultKey = this.buildResultKey(result);
        return resultKey !== this.lastAppliedResultKey && resultKey !== this.pendingRoundResult?.resultKey;
    }

    private handleCombatEndPopupRequest(popup: CombatStartPopupData): void {
        if (this.isAnySequenceActivityInProgress() || this.hasUnappliedLatestResultForCurrentDuel()) {
            this.pendingCombatEndPopup = popup;
            return;
        }

        this.showCombatEndPopup(popup);
    }

    private showPendingCombatEndPopupIfReady(): void {
        if (
            this.isAnySequenceActivityInProgress() ||
            this.damagePopup ||
            this.combatStartPopup ||
            this.roundAnnouncementPopup ||
            !this.pendingCombatEndPopup
        ) {
            return;
        }

        const pendingPopup = this.pendingCombatEndPopup;
        this.pendingCombatEndPopup = null;
        this.showCombatEndPopup(pendingPopup);
    }

    private showCombatEndPopup(popup: CombatStartPopupData): void {
        this.hideCombatEndPopup();
        this.combatEndPopup = popup;

        this.combatEndPopupTimeout = setTimeout(() => {
            this.combatEndPopup = null;
            this.combatEndPopupTimeout = null;
            this.gameViewService.completeCombatOverlay();
        }, COMBAT_END_POPUP_DISPLAY_DURATION_MS);
    }

    private showCombatStartPopup(): void {
        this.hideCombatStartPopup();
        const initiatorName = this.gameViewService.combatInitiatorName() || this.player?.character?.name || 'Un joueur';
        this.combatStartPopup = {
            title: 'Combat lancé',
            message: `${initiatorName} a initié le combat. Préparez votre posture.`,
        };

        this.combatStartPopupTimeout = setTimeout(() => {
            this.combatStartPopup = null;
            this.combatStartPopupTimeout = null;
        }, COMBAT_START_POPUP_DISPLAY_DURATION_MS);
    }

    private showRoundAnnouncementPopup(roundIndex: number): void {
        this.roundAnnouncementPopup = {
            roundIndex,
            message: `Tour ${roundIndex} dans un instant...`,
        };
    }

    private showDamagePopup(damageDealt: number, damageReceived: number, rollIndex: number): void {
        this.damagePopup = { damageDealt, damageReceived, rollIndex };
    }

    private hideCombatStartPopup(): void {
        this.clearCombatStartPopupTimeout();
        this.combatStartPopup = null;
    }

    private hideCombatEndPopup(): void {
        this.clearCombatEndPopupTimeout();
        this.combatEndPopup = null;
    }

    private hideDamagePopup(): void {
        this.damagePopup = null;
    }

    private syncDisplayedLivesWithCurrentFighters(): void {
        this.displayedLifeBySide = {
            player: this.player.character.life,
            enemy: this.enemy.character.life,
        };
    }

    private applyPendingLifeAfterAttackAnimation(): void {
        if (!this.pendingLifeBySide) return;

        this.displayedLifeBySide = {
            player: this.pendingLifeBySide.player,
            enemy: this.pendingLifeBySide.enemy,
        };
        this.pendingLifeBySide = null;
    }

    private applySequentialLifeDamage(side: FighterSide, damage: number): void {
        if (damage <= 0) return;

        const nextLifeValue = Math.max(this.displayedLifeBySide[side] - damage, 0);
        this.displayedLifeBySide = {
            ...this.displayedLifeBySide,
            [side]: nextLifeValue,
        };
    }

    private spawnImpactDamagePopup(targetSocketId: string, damage: number): void {
        if (damage <= 0) return;

        const targetPosition = this.playerPos[targetSocketId] ?? this.getBaseCombatPositions()[targetSocketId];
        if (!targetPosition) return;

        const gridRows = this.combatMap.length || IMPACT_POPUP_DEFAULT_GRID_DIMENSION;
        const gridColumns = this.combatMap[0]?.length || IMPACT_POPUP_DEFAULT_GRID_DIMENSION;
        const horizontalCenterPercent = ((targetPosition.x + IMPACT_POPUP_TILE_CENTER_OFFSET) / gridColumns) * TO_PERCENT;
        const verticalCenterPercent = ((targetPosition.y + IMPACT_POPUP_TILE_CENTER_OFFSET) / gridRows) * TO_PERCENT;

        const popupId = ++this.impactDamagePopupIdCounter;
        const targetIsPlayer = targetSocketId === this.player.socketId;

        const popup: ImpactDamagePopupData = {
            id: popupId,
            text: `-${damage}`,
            leftPercent: Math.min(IMPACT_POPUP_MAX_PERCENT, Math.max(IMPACT_POPUP_MIN_PERCENT, horizontalCenterPercent)),
            topPercent: Math.min(
                IMPACT_POPUP_MAX_PERCENT,
                Math.max(IMPACT_POPUP_MIN_PERCENT, verticalCenterPercent - IMPACT_POPUP_VERTICAL_OFFSET_PERCENT),
            ),
            tiltDeg: targetIsPlayer ? IMPACT_POPUP_PLAYER_TILT_DEG : IMPACT_POPUP_ENEMY_TILT_DEG,
        };

        this.impactDamagePopups = [...this.impactDamagePopups, popup];

        const popupTimeout = setTimeout(() => {
            this.impactDamagePopups = this.impactDamagePopups.filter((activePopup) => activePopup.id !== popupId);
            this.impactDamagePopupTimeouts = this.impactDamagePopupTimeouts.filter((activeTimeout) => activeTimeout !== popupTimeout);
        }, this.scaleDuration(IMPACT_POPUP_DURATION_MS));

        this.impactDamagePopupTimeouts.push(popupTimeout);
    }

    private applyImpactDamageForAttacker(attackerSocketId: string): void {
        const damage = this.roundDamageByAttackerSocket[attackerSocketId] ?? 0;
        if (damage <= 0) return;

        const targetSide: FighterSide = attackerSocketId === this.player.socketId ? 'enemy' : 'player';
        const targetSocketId = targetSide === 'player' ? this.player.socketId : this.enemy.socketId;

        this.applySequentialLifeDamage(targetSide, damage);
        this.spawnImpactDamagePopup(targetSocketId, damage);
    }

    private clearRoundBonusesAfterAttackAnimation(): void {
        this.roundResult = null;
        this.player.character.bonusPosture = { type: null, bonus: 0 };
        this.enemy.character.bonusPosture = { type: null, bonus: 0 };
    }

    private getDiceFaces(diceNotation: string | undefined): number {
        const parsedFaces = Number(diceNotation?.slice(1));
        if (!Number.isFinite(parsedFaces) || parsedFaces <= 0) return DEFAULT_DICE_FACES;
        return parsedFaces;
    }

    private buildDiceDisplayData(attackValue: number, defenseValue: number, side: FighterSide): FighterDiceDisplayData {
        const fighter = this.getFighterBySide(side);
        const fighterName = fighter?.character?.name ?? 'Joueur';
        const attackDice = fighter?.character?.attackDice;
        const defenseDice = fighter?.character?.defenseDice;

        return {
            fighterName,
            attackFaces: this.getDiceFaces(attackDice),
            defenseFaces: this.getDiceFaces(defenseDice),
            attackValue,
            defenseValue,
        };
    }

    private playRoundDiceAnimation({
        sequenceToken,
        roundResult,
        rollDurationMs,
        resultDurationMs,
        debugDiceMode,
        onFinished,
    }: RoundDiceAnimationParams): void {
        this.clearDiceRollAnimations();
        this.isDiceRollInProgress = true;

        let playerAttackValue = debugDiceMode ? roundResult.player.attack.dice : 1;
        let playerDefenseValue = debugDiceMode ? roundResult.player.defense.dice : 1;
        let enemyAttackValue = debugDiceMode ? roundResult.enemy.attack.dice : 1;
        let enemyDefenseValue = debugDiceMode ? roundResult.enemy.defense.dice : 1;

        const playerAttackFaces = this.getDiceFaces(this.player.character.attackDice);
        const playerDefenseFaces = this.getDiceFaces(this.player.character.defenseDice);
        const enemyAttackFaces = this.getDiceFaces(this.enemy.character.attackDice);
        const enemyDefenseFaces = this.getDiceFaces(this.enemy.character.defenseDice);

        this.diceRollDisplay = {
            player: this.buildDiceDisplayData(playerAttackValue, playerDefenseValue, 'player'),
            enemy: this.buildDiceDisplayData(enemyAttackValue, enemyDefenseValue, 'enemy'),
            isFinal: false,
        };

        this.diceRollInterval = setInterval(() => {
            if (!this.isRoundSequenceTokenActive(sequenceToken)) return;

            if (debugDiceMode) {
                playerAttackValue = roundResult.player.attack.dice;
                playerDefenseValue = roundResult.player.defense.dice;
                enemyAttackValue = roundResult.enemy.attack.dice;
                enemyDefenseValue = roundResult.enemy.defense.dice;
            } else {
                playerAttackValue = Math.floor(Math.random() * playerAttackFaces) + 1;
                playerDefenseValue = Math.floor(Math.random() * playerDefenseFaces) + 1;
                enemyAttackValue = Math.floor(Math.random() * enemyAttackFaces) + 1;
                enemyDefenseValue = Math.floor(Math.random() * enemyDefenseFaces) + 1;
            }

            this.diceRollDisplay = {
                player: this.buildDiceDisplayData(playerAttackValue, playerDefenseValue, 'player'),
                enemy: this.buildDiceDisplayData(enemyAttackValue, enemyDefenseValue, 'enemy'),
                isFinal: false,
            };
        }, DICE_ROLL_TICK_MS);

        const settleTimeout = setTimeout(() => {
            if (!this.isRoundSequenceTokenActive(sequenceToken)) return;

            this.clearDiceRollInterval();
            this.diceRollDisplay = {
                player: this.buildDiceDisplayData(roundResult.player.attack.dice, roundResult.player.defense.dice, 'player'),
                enemy: this.buildDiceDisplayData(roundResult.enemy.attack.dice, roundResult.enemy.defense.dice, 'enemy'),
                isFinal: true,
            };

            const resultTimeout = setTimeout(() => {
                if (!this.isRoundSequenceTokenActive(sequenceToken)) return;
                this.isDiceRollInProgress = false;
                this.diceRollDisplay = null;
                onFinished();
            }, resultDurationMs);

            this.diceRollAnimationTimeouts.push(resultTimeout);
        }, rollDurationMs);

        this.diceRollAnimationTimeouts.push(settleTimeout);
    }

    private animateFighterPosition({
        sequenceToken,
        fighterSocketId,
        from,
        to,
        durationMs,
        onComplete,
    }: FighterPositionAnimationParams): void {
        this.clearMovementAnimationFrame();
        const animationStartMs = performance.now();

        const step = (frameTimeMs: number) => {
            if (!this.isRoundSequenceTokenActive(sequenceToken)) return;

            const elapsedMs = frameTimeMs - animationStartMs;
            const linearProgress = Math.min(1, elapsedMs / durationMs);
            const easedProgress = linearProgress < EASE_PROGRESS_MIDDLE_POINT
                ? EASE_ACCELERATION_FACTOR * linearProgress * linearProgress * linearProgress
                : 1 - Math.pow((EASE_DECELERATION_FACTOR * linearProgress) + EASE_DECELERATION_OFFSET, EASE_POWER) / EASE_DIVISOR;

            this.playerPos = {
                ...this.playerPos,
                [fighterSocketId]: {
                    x: from.x + ((to.x - from.x) * easedProgress),
                    y: from.y + ((to.y - from.y) * easedProgress),
                },
            };

            if (linearProgress >= 1) {
                this.movementAnimationFrameId = null;
                onComplete();
                return;
            }

            this.movementAnimationFrameId = requestAnimationFrame(step);
        };

        this.movementAnimationFrameId = requestAnimationFrame(step);
    }

    private runFighterMovementPhase({
        sequenceToken,
        attackerSocketId,
        defenderSocketId,
        advanceDurationMs,
        holdDurationMs,
        retreatDurationMs,
        onComplete,
    }: FighterMovementPhaseParams): void {
        const basePositions = this.getBaseCombatPositions();
        const attackerBasePosition = basePositions[attackerSocketId];
        const defenderBasePosition = basePositions[defenderSocketId];
        if (!attackerBasePosition || !defenderBasePosition) {
            onComplete();
            return;
        }

        const attackerLungePosition = this.computeLungePosition(attackerBasePosition, defenderBasePosition);

        this.isAttackAnimationInProgress = true;
        this.currentAttackerSocketId = attackerSocketId;

        this.animateFighterPosition({
            sequenceToken,
            fighterSocketId: attackerSocketId,
            from: this.playerPos[attackerSocketId] ?? attackerBasePosition,
            to: attackerLungePosition,
            durationMs: advanceDurationMs,
            onComplete: () => {
                if (!this.isRoundSequenceTokenActive(sequenceToken)) return;

                this.applyImpactDamageForAttacker(attackerSocketId);

                this.enqueueRoundStep(sequenceToken, holdDurationMs, () => {
                    this.animateFighterPosition({
                        sequenceToken,
                        fighterSocketId: attackerSocketId,
                        from: attackerLungePosition,
                        to: attackerBasePosition,
                        durationMs: retreatDurationMs,
                        onComplete: () => {
                            if (!this.isRoundSequenceTokenActive(sequenceToken)) return;

                            this.playerPos = { ...basePositions };
                            this.isAttackAnimationInProgress = false;
                            this.currentAttackerSocketId = null;
                            onComplete();
                        },
                    });
                });
            },
        });
    }

    private runRoundMovementPhase(
        sequenceToken: number,
        attackerSocketId: string,
        defenderSocketId: string,
        roundTimeline: CombatRoundTimelineData,
        onComplete: () => void,
    ): void {
        this.runFighterMovementPhase({
            sequenceToken,
            attackerSocketId,
            defenderSocketId,
            advanceDurationMs: roundTimeline.fighterAdvanceDurationMs,
            holdDurationMs: roundTimeline.fighterHoldDurationMs,
            retreatDurationMs: roundTimeline.fighterRetreatDurationMs,
            onComplete,
        });
    }

    private runRoundPhasePipeline(sequenceToken: number, steps: RoundPhaseStep[]): void {
        if (steps.length === 0) return;

        const [currentStep, ...remainingSteps] = steps;
        this.enqueueRoundStep(sequenceToken, currentStep.delayMs, () => {
            currentStep.action(() => this.runRoundPhasePipeline(sequenceToken, remainingSteps));
        });
    }

    private buildRoundResolutionSteps(
        sequenceToken: number,
        roundTimeline: CombatRoundTimelineData,
        damageDealt: number,
        damageReceived: number,
        roundIndex: number,
    ): RoundPhaseStep[] {
        return [
            {
                delayMs: roundTimeline.roundPhaseBufferMs,
                action: (next) => this.runRoundMovementPhase(
                    sequenceToken,
                    this.player.socketId,
                    this.enemy.socketId,
                    roundTimeline,
                    next,
                ),
            },
            {
                delayMs: roundTimeline.roundPhaseBufferMs,
                action: (next) => this.runRoundMovementPhase(
                    sequenceToken,
                    this.enemy.socketId,
                    this.player.socketId,
                    roundTimeline,
                    next,
                ),
            },
            {
                delayMs: 0,
                action: (next) => {
                    this.applyPendingLifeAfterAttackAnimation();
                    this.clearRoundBonusesAfterAttackAnimation();
                    next();
                },
            },
            {
                delayMs: roundTimeline.roundPhaseBufferMs,
                action: (next) => {
                    this.showDamagePopup(damageDealt, damageReceived, roundIndex);
                    next();
                },
            },
            {
                delayMs: roundTimeline.damageDisplayDurationMs,
                action: (next) => {
                    this.hideDamagePopup();
                    next();
                },
            },
            {
                delayMs: 0,
                action: (next) => {
                    if (this.hasDeadFighter() || this.pendingCombatEndPopup) {
                        this.finishRoundSequence(sequenceToken);
                        return;
                    }

                    const nextRoundIndex = this.getCurrentRoundIndex() + 1;
                    this.showRoundAnnouncementPopup(nextRoundIndex);
                    next();
                },
            },
            {
                delayMs: roundTimeline.nextRoundAnnouncementDurationMs,
                action: () => {
                    this.roundAnnouncementPopup = null;
                    this.finishRoundSequence(sequenceToken);
                },
            },
        ];
    }

    private finishRoundSequence(sequenceToken: number): void {
        if (!this.isRoundSequenceTokenActive(sequenceToken)) return;

        this.applyPendingLifeAfterAttackAnimation();

        this.isRoundSequenceInProgress = false;
        this.isAttackAnimationInProgress = false;
        this.isDiceRollInProgress = false;
        this.currentAttackerSocketId = null;
        this.playerPos = this.getBaseCombatPositions();

        this.showPendingCombatEndPopupIfReady();
        this.applyPendingRoundResultIfReady();
    }

    private runRoundResolutionSequence({
        sequenceToken,
        roundResult,
        damageDealt,
        damageReceived,
        roundIndex,
        timeline,
        debugDiceMode,
    }: RoundResolutionSequenceParams): void {
        const roundTimeline = this.getRoundTimeline(timeline);

        this.playRoundDiceAnimation({
            sequenceToken,
            roundResult,
            rollDurationMs: roundTimeline.diceRollDurationMs,
            resultDurationMs: roundTimeline.diceResultDisplayDurationMs,
            debugDiceMode,
            onFinished: () => {
                this.roundResult = roundResult;

                const roundSteps = this.buildRoundResolutionSteps(
                    sequenceToken,
                    roundTimeline,
                    damageDealt,
                    damageReceived,
                    roundIndex,
                );
                this.runRoundPhasePipeline(sequenceToken, roundSteps);
            },
        });
    }

    private applyLatestServerResult(): void {
        const payload = this.getLatestCombatResultPayload();
        if (!payload || !this.isResultForCurrentDuel(payload.result)) return;

        const resultKey = this.buildResultKey(payload.result, payload.roundIndex, payload.resolvedAtEpochMs);
        if (resultKey === this.lastAppliedResultKey || resultKey === this.pendingRoundResult?.resultKey) return;

        if (this.isAnySequenceActivityInProgress()) {
            this.pendingRoundResult = {
                result: payload.result,
                resultKey,
                timeline: payload.timeline,
                debugDiceMode: Boolean(payload.debugDiceMode),
            };
            return;
        }

        this.applyRoundResult(payload.result, resultKey, payload.timeline, Boolean(payload.debugDiceMode));
    }

    private getLatestCombatResultPayload(): {
        result: CombatResult;
        timeline: CombatRoundTimelineData | null;
        debugDiceMode?: boolean;
        roundIndex?: number;
        resolvedAtEpochMs?: number;
    } | null {
        const roundResolved = this.gameViewService.lastCombatRoundResolved();
        if (!roundResolved) return null;
        if (roundResolved.roomId !== this.gameViewService.getCurrentCombatRoomId()) return null;

        return {
            result: roundResolved.result,
            timeline: roundResolved.timeline ?? null,
            debugDiceMode: roundResolved.debugDiceMode,
            roundIndex: roundResolved.roundIndex,
            resolvedAtEpochMs: roundResolved.resolvedAtEpochMs,
        };
    }

    private isResultForCurrentDuel(result: CombatResult): boolean {
        return (
            (result.attacker.socketId === this.player.socketId && result.defender.socketId === this.enemy.socketId) ||
            (result.attacker.socketId === this.enemy.socketId && result.defender.socketId === this.player.socketId)
        );
    }

    private buildResultKey(result: CombatResult, roundIndex?: number, resolvedAtEpochMs?: number): string {
        return [
            result.attacker.socketId,
            result.defender.socketId,
            result.attacker.lifeAfter,
            result.defender.lifeAfter,
            result.attacker.damageDealt,
            result.defender.damageDealt,
            roundIndex ?? 'na',
            resolvedAtEpochMs ?? 'na',
        ].join(':');
    }

    private applyPendingRoundResultIfReady(): void {
        if (this.isAnySequenceActivityInProgress() || !this.pendingRoundResult) return;
        const pendingRoundResult = this.pendingRoundResult;
        this.pendingRoundResult = null;
        this.applyRoundResult(
            pendingRoundResult.result,
            pendingRoundResult.resultKey,
            pendingRoundResult.timeline,
            pendingRoundResult.debugDiceMode,
        );
    }

    private applyRoundResult(
        result: CombatResult,
        resultKey: string,
        timeline: CombatRoundTimelineData | null,
        debugDiceMode: boolean,
    ): void {
        this.lastAppliedResultKey = resultKey;

        const localIsAttacker = result.attacker.socketId === this.player.socketId;
        const local = localIsAttacker ? result.attacker : result.defender;
        const enemy = localIsAttacker ? result.defender : result.attacker;

        this.rollCount++;
        this.pendingLifeBySide = {
            player: local.killed ? 0 : local.lifeAfter,
            enemy: enemy.killed ? 0 : enemy.lifeAfter,
        };
        this.roundDamageByAttackerSocket = {
            [this.player.socketId]: Math.max(local.damageDealt, 0),
            [this.enemy.socketId]: Math.max(enemy.damageDealt, 0),
        };

        const computedRoundResult: RoundDetailedResult = {
            player: {
                attack: {
                    base: local.attack.base,
                    postureBonus: local.attack.postureBonus,
                    dice: local.attack.diceBonus,
                    penalty: local.attack.penalty,
                    total: local.attack.total,
                },
                defense: {
                    base: local.defense.base,
                    postureBonus: local.defense.postureBonus,
                    dice: local.defense.diceBonus,
                    penalty: local.defense.penalty,
                    total: local.defense.total,
                },
            },
            enemy: {
                attack: {
                    base: enemy.attack.base,
                    postureBonus: enemy.attack.postureBonus,
                    dice: enemy.attack.diceBonus,
                    penalty: enemy.attack.penalty,
                    total: enemy.attack.total,
                },
                defense: {
                    base: enemy.defense.base,
                    postureBonus: enemy.defense.postureBonus,
                    dice: enemy.defense.diceBonus,
                    penalty: enemy.defense.penalty,
                    total: enemy.defense.total,
                },
            },
            rollIndex: this.rollCount,
        };

        this.roundAnnouncementPopup = null;
        this.hideDamagePopup();

        this.isRoundSequenceInProgress = true;
        this.clearRoundSequenceTimeouts();
        const sequenceToken = this.createRoundSequenceToken();
        this.runRoundResolutionSequence({
            sequenceToken,
            roundResult: computedRoundResult,
            damageDealt: local.damageDealt,
            damageReceived: enemy.damageDealt,
            roundIndex: this.rollCount,
            timeline,
            debugDiceMode,
        });
    }

    private showToast(
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
}
