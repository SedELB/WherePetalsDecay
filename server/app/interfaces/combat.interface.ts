import { Player } from '@common/player';
import { Posture } from '@common/character';
import { Vec2 } from '@common/vec2';

export type DiceRollMode = 'random' | 'max' | 'min';

export interface CombatDiceStrategy {
    attacker: DiceRollMode;
    defender: DiceRollMode;
}

export interface CombatParticipants {
    attacker: Player;
    defender: Player;
    attackerOldPosition: Vec2;
    defenderOldPosition: Vec2;
}

export interface CombatStatValue {
    base: number;
    postureBonus: number;
    diceBonus: number;
    penalty: number;
    total: number;
}

export interface CombatStatsSnapshot {
    attackerAttack: CombatStatValue;
    attackerDefense: CombatStatValue;
    defenderAttack: CombatStatValue;
    defenderDefense: CombatStatValue;
    damageToDefender: number;
    damageToAttacker: number;
    attackerLifeBefore: number;
    defenderLifeBefore: number;
}

export interface CombatDeathResolution {
    attackerKilled: boolean;
    defenderKilled: boolean;
    winnerId: string | null;
    loserId: string | null;
    attackerNewPosition: Vec2 | null;
    defenderNewPosition: Vec2 | null;
}

export interface StatInput {
    base: number;
    postureBonus: number;
    diceBonus: number;
    penalty: number;
}

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
}
