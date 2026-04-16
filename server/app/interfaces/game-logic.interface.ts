import { SanctuaryMode, TileItem, TileTexture } from '@common/enums';
import { Vec2 } from '@common/vec2';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';

export interface InitiateCombatPayload {
    lobbyId: string;
    attackerId: string;
    defenderId: string;
    consumeActionPoint?: boolean;
}

export interface TransferFlagPayload {
    lobbyId: string;
    giverPlayerId: string;
    targetPlayerId: string;
    payerId: string;
}

export interface UseSanctuaryPayload {
    lobbyId: string;
    socketId: string;
    position: Vec2;
    mode: SanctuaryMode;
}

export interface PlayerAbandonPayload {
    lobbyId: string;
    deferTurnAdvance?: boolean;
}

export interface TileVisitParams {
    game: ActiveGame;
    socketId: string;
    pos: Vec2;
    tileType: TileTexture;
    tileItem: TileItem | null;
}
