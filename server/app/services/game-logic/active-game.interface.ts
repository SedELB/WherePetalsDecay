import { Lobby } from '@common/lobby';
import { Vec2 } from '@common/vec2';

export const VICTORIES_TO_WIN = 3;
export const TURN_DURATION = 30;
export const TURN_DELAY = 3;
export const SECOND = 1000;
export const MAX_ACTION_POINTS = 1;

export interface ActiveGame {
    lobby: Lobby;
    turnOrder: string[];
    currentTurnIndex: number;
    playerPositions: Map<string, Vec2>;
    playerStartPositions: Map<string, Vec2>;
    movementPoints: Map<string, number>;
    actionPoints: Map<string, number>;
    isDebugMode?: boolean;
    visitedTilesPerPlayer: Map<string, Set<string>>;
    globalVisitedTiles: Set<string>;
    sanctuariesUsed: Set<string>;
    doorsInteracted: Set<string>;
    flagHolders: Set<string>;
    totalTurns: number;
    gameStartTime: number;
}

export interface TurnCallbacks {
    onBetweenTurnCountdown: (lobbyId: string, secondsLeft: number) => void;
    onTurnCountdown: (lobbyId: string, secondsLeft: number) => void;
    onTurnStarted: (lobbyId: string, playerSocketId: string) => void;
    onTurnEnded: (lobbyId: string, playerSocketId: string) => void;
}
