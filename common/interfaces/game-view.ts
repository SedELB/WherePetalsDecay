import { Player } from '@common/player';
import { Posture } from '../character';
import { Lobby } from '../lobby';
import { Tile } from '../tile';
import { Vec2 } from '../vec2';
import { GameStats } from './game-stats';

export interface CombatStartedData {
    player: Player;
    enemy: Player;
    roomId: string;
}

export interface GameOverEventData {
    winnerSocketId?: string | null;
    isForfeit?: boolean;
    abandonTeam?: string;
    players?: Player[];
    gameStats?: GameStats | null;
}
export interface CombatEndedData {
    roomId: string;
    attackerSocketId: string;
    defenderSocketId: string;
    attackerKilled: boolean;
    defenderKilled: boolean;
    winnerId: string | null;
    reason: 'death' | 'abandon';
}

export interface CombatLockStateData {
    lobbyId: string;
    isLocked: boolean;
    roomId?: string;
    attackerSocketId?: string;
    defenderSocketId?: string;
}

export interface CombatAttackAnimationData {
    lobbyId: string;
    attackerSocketId: string;
    defenderSocketId: string;
    durationMs: number;
}

export interface PostureReceivedData {
    socketId: string;
    posture: Posture;
}

export interface CombatRoundStartedData {
    roomId: string;
    roundIndex: number;
    postureTimeoutMs: number;
    postureCountdownDelayMs?: number;
}

export interface CombatRoundCountdownData {
    roomId: string;
    roundIndex: number;
    secondsLeft: number;
}

export interface CombatStatBreakdown {
    base: number;
    postureBonus: number;
    diceBonus: number;
    penalty: number;
    total: number;
}

export interface CombatFighterResult {
    socketId: string;
    attack: CombatStatBreakdown;
    defense: CombatStatBreakdown;
    damageDealt: number;
    lifeBefore: number;
    lifeAfter: number;
    killed: boolean;
    oldPosition: Vec2;
    newPosition: Vec2 | null;
}

export interface PlayerMovedData {
    socketId: string;
    position: Vec2;
    movementPoints: number;
    flagTaken?: boolean;
}

export interface CombatResult {
    attacker: CombatFighterResult;
    defender: CombatFighterResult;
    winnerId: string | null;
    loserId: string | null;

    // Kept for compatibility with the previous version
    loser?: Player;
    damage?: number;
    loserHpLeft?: number;
    killed?: boolean;
    loserNewPosition?: Vec2 | null;
    loserOldPosition?: Vec2;

    wasFlagDropped?: boolean;
    droppedFlagPosition?: Vec2;
}

export interface CombatRoundTimelineData {
    postureResultDisplayDurationMs: number;
    roundPhaseBufferMs: number;
    diceRollDurationMs: number;
    diceResultDisplayDurationMs: number;
    damageDisplayDurationMs: number;
    fighterAdvanceDurationMs: number;
    fighterHoldDurationMs: number;
    fighterRetreatDurationMs: number;
    statusBufferDurationMs: number;
    nextRoundAnnouncementDurationMs: number;
}

export interface CombatRoundResolvedData {
    roomId: string;
    roundIndex: number;
    result: CombatResult;
    timedOutSocketIds?: string[];
    resolvedAtEpochMs?: number;
    timeline?: CombatRoundTimelineData;
    debugDiceMode?: boolean;
}

export interface GameStartedData {
    lobby: Lobby;
    turnOrder: string[];
    playerPositions: Record<string, Vec2>;
    playerStartPositions: Record<string, Vec2>;
}

export interface TileInfoData {
    tile: Tile;
    cost: number;
    player: { name: string; avatar: string } | null;
}

export interface GameOverData {
    winnerSocketId?: string | null;
    isForfeit?: boolean;
    abandonTeam?: string;
    players: Player[];
    gameStats: GameStats;
}
