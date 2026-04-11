import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';

const TEN = 10;

export interface TileClickContext {
    lobbyId: string;
    currentPlayer: Player;
    targetPlayer: Player;
    targetSocketId: string;
}

export function findPlayerAtPosition(positions: Record<string, Vec2>, x: number, y: number): string | null {
    for (const [socketId, pos] of Object.entries(positions)) {
        if (pos.x === x && pos.y === y) return socketId;
    }
    return null;
}

export function getPlayerAvatarById(players: Player[], socketId: string): string | undefined {
    return players.find((player) => player.socketId === socketId)?.character?.avatar;
}

export function getPlayerNameById(players: Player[], socketId: string): string {
    return players.find((player) => player.socketId === socketId)?.character?.name ?? 'Un joueur';
}

export function getTimerLabelForTurn(activeId: string | null, localId: string | undefined, players: Player[]): string {
    if (!activeId) return 'Prochain tour...';
    const name = getPlayerNameById(players, activeId);
    return activeId === localId ? 'Votre tour' : `Tour de ${name}`;
}

export function getTimerDisplayFromCountdown(countdown: number, activeId: string | null): string {
    if (!activeId) return `00:0${countdown}`;
    return `00:${countdown < TEN ? '0' : ''}${countdown}`;
}

export function getTeamPlayersFromLobby(lobby: Lobby | null, orderedPlayers: Player[], team: 'A' | 'B'): Player[] {
    if (!lobby) return [];
    if (team === 'A') {
        return orderedPlayers.filter((player) => lobby.teamA.some((teamPlayer) => teamPlayer.socketId === player.socketId));
    }
    return orderedPlayers.filter((player) => lobby.teamB.some((teamPlayer) => teamPlayer.socketId === player.socketId));
}

export function buildTileClickContext(args: {
    lobby: Lobby | null;
    currentSocketId: string | undefined;
    actionPoints: number;
    targetSocketId: string | null;
    x: number;
    y: number;
    isHighlighted: boolean;
}): TileClickContext | null {
    const { lobby, currentSocketId, actionPoints, targetSocketId, isHighlighted } = args;
    const lobbyId = lobby?.lobbyId;
    const currentPlayer = lobby?.players.find((player) => player.socketId === currentSocketId);
    if (!lobbyId || !currentSocketId || !currentPlayer || actionPoints <= 0) return null;
    if (!targetSocketId || targetSocketId === currentSocketId || !isHighlighted) return null;

    const targetPlayer = lobby?.players.find((player) => player.socketId === targetSocketId);
    if (!targetPlayer) return null;

    return { lobbyId, currentPlayer, targetPlayer, targetSocketId };
}

export function getCurrentPlayerIceDebuff(
    currentSocketId: string | undefined,
    positions: Record<string, Vec2>,
    isOnIce: (position: Vec2) => 2 | 0,
): 2 | 0 {
    if (!currentSocketId) return 0;
    const currentPosition = positions[currentSocketId];
    if (!currentPosition) return 0;
    return isOnIce(currentPosition);
}
