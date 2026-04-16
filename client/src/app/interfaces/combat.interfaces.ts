import { PostureType } from '@common/enums';
import { CombatResult, CombatRoundTimelineData } from '@common/interfaces/game-view';
import { Lobby } from '@common/lobby';
import { Vec2 } from '@common/vec2';

export type TypePosture = PostureType | null;
export type FighterSide = 'player' | 'enemy';
export type FighterStatType = 'attack' | 'defense';

export interface DetailedStatLine { base: number; postureBonus: number; dice: number; penalty: number; total: number; }
export interface FighterDetailedResult { attack: DetailedStatLine; defense: DetailedStatLine; }
export interface RoundDetailedResult { player: FighterDetailedResult; enemy: FighterDetailedResult; rollIndex: number; }
export interface DamagePopupData { damageDealt: number; damageReceived: number; rollIndex: number; }
export interface CombatStartPopupData { title: string; message: string; }
export interface PendingRoundResult {
    result: CombatResult;
    resultKey: string;
    timeline: CombatRoundTimelineData | null;
    debugDiceMode: boolean;
}
export interface RoundAnnouncementPopupData { roundIndex: number; message: string; }
export interface ImpactDamagePopupData {
    id: number;
    text: string;
    isZeroDamage: boolean;
    leftPercent: number;
    topPercent: number;
    tiltDeg: number;
}
export type LifeBySide = Record<FighterSide, number>;
export interface FighterDiceDisplayData {
    fighterName: string;
    attackFaces: number;
    defenseFaces: number;
    attackValue: number;
    defenseValue: number;
}
export interface DiceRollDisplayData {
    player: FighterDiceDisplayData;
    enemy: FighterDiceDisplayData;
    isFinal: boolean;
}
export interface FighterPositionAnimationParams {
    sequenceToken: number;
    fighterSocketId: string;
    from: Vec2;
    to: Vec2;
    durationMs: number;
    onComplete: () => void;
}
export interface FighterMovementPhaseParams {
    sequenceToken: number;
    attackerSocketId: string;
    defenderSocketId: string;
    advanceDurationMs: number;
    holdDurationMs: number;
    retreatDurationMs: number;
    onComplete: () => void;
}
export interface RoundResolutionSequenceParams {
    sequenceToken: number;
    roundResult: RoundDetailedResult;
    damageDealt: number;
    damageReceived: number;
    roundIndex: number;
    timeline: CombatRoundTimelineData | null;
    debugDiceMode: boolean;
}
export type RoundPhaseAction = (next: () => void) => void;
export interface RoundPhaseStep {
    delayMs: number;
    action: RoundPhaseAction;
}
export interface RoundDiceAnimationParams {
    sequenceToken: number;
    roundResult: RoundDetailedResult;
    rollDurationMs: number;
    resultDurationMs: number;
    debugDiceMode: boolean;
    onFinished: () => void;
}

export interface GridDimensions {
    rows: number;
    cols: number;
}

export interface DiceAnimationDurations {
    rollMs: number;
    resultMs: number;
}

export interface ImpactPopupPosition {
    leftPercent: number;
    topPercent: number;
}

export interface FighterStatDisplay {
    total: number;
    postureBonus: number;
    diceBonus: number;
    iceDebuff: number;
}

export interface CombatEndPopupData { title: string; message: string; }

export interface CombatListenerDependencies {
    getLocalSocketId: () => string | undefined;
    getGameLobby: () => Lobby | null;
    getPlayerPositions: () => Record<string, Vec2>;
    updateGameLobby: (updater: (lobby: Lobby | null) => Lobby | null) => void;
    updatePlayerPositions: (updater: (positions: Record<string, Vec2>) => Record<string, Vec2>) => void;
    setFlagTaken: (value: boolean) => void;
}
