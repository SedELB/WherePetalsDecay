import { Direction } from '@common/direction';
import { Player } from '@common/player';
import { Posture } from '@common/character';
import { Vec2 } from '@common/vec2';
import { SanctuaryMode, VirtualPlayerProfile } from '@common/enums';
import { Game } from '@common/game';

export interface MoveRequestPayload {
    lobbyId: string;
    direction: Direction;
}

export interface TeleportPayload {
    lobbyId: string;
    position: Vec2;
}

export interface ToggleDebugPayload {
    lobbyId: string;
    state: boolean;
}

export interface SendPosturePayload {
    lobbyId: string;
    roomId: string;
    posture: Posture;
}

export interface RequestCombatPayload {
    lobbyId: string;
    enemy: { socketId: string };
}

export interface CreateLobbyPayload {
    game: Game;
    player: Player;
}

export interface JoinLobbyPayload {
    lobbyId: string;
    player: Player;
}

export interface SelectAvatarPayload {
    lobbyId: string;
    avatar: string;
}

export interface AddVirtualPlayerPayload {
    lobbyId: string;
    profile: VirtualPlayerProfile;
}

export interface TargetPlayerPayload {
    lobbyId: string;
    targetSocketId: string;
}

export interface FlagTransferResponsePayload {
    lobbyId: string;
    requesterId: string;
    accepted: boolean;
    isRequest?: boolean;
}

export interface RequestTileInfoPayload {
    lobbyId: string;
    position: Vec2;
}

export interface RequestToggleDoorPayload {
    lobbyId: string;
    position: Vec2;
}

export interface RequestUseSanctuaryPayload {
    lobbyId: string;
    position: { x: number; y: number };
    mode: SanctuaryMode;
}

export interface FlagTransferParams {
    lobbyId: string;
    giverId: string;
    receiverId: string;
    actionPointUpdaterId: string;
}

export interface PostMoveJournalParams {
    lobbyId: string;
    socketId: string;
    position: Vec2;
    flagJustTaken: boolean;
}
