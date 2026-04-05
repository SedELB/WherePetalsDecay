import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';

export function getTeamPlayers(team: 'A' | 'B', lobby: Lobby | null, orderedPlayers: Player[] | null): Player[] {
    if (!lobby || !orderedPlayers) return [];

    if (team === 'A') {
        return orderedPlayers.filter(player => lobby.teamA.some(p => p.socketId === player.socketId));
    } else {
        return orderedPlayers.filter(player => lobby.teamB.some(p => p.socketId === player.socketId));
    }
}

export function getAttackTargets(
    localId: string | null,
    adjacentPlayers: Player[],
    playerPositions: Record<string, Vec2>,
    teams: Player[][],
): Vec2[] {
    if (!localId) return [];
    return adjacentPlayers
        .filter(p => {
            const isSameTeam = teams.some(team =>
                team.some(t => t.socketId === localId) &&
                team.some(t => t.socketId === p.socketId),
            );
            return !isSameTeam;
        })
        .map(p => playerPositions[p.socketId])
        .filter((pos): pos is Vec2 => !!pos);
}

export function getRequestFlagTargets(
    localPlayer: Player | undefined,
    localId: string | null,
    adjacentPlayers: Player[],
    playerPositions: Record<string, Vec2>,
    teams: Player[][],
): Vec2[] {
    if (!localPlayer || localPlayer.hasFlag || !localId) return [];
    return adjacentPlayers
        .filter(p => {
            const isSameTeam = teams.some(team =>
                team.some(t => t.socketId === localId) &&
                team.some(t => t.socketId === p.socketId),
            );
            return isSameTeam && p.hasFlag;
        })
        .map(p => playerPositions[p.socketId])
        .filter((pos): pos is Vec2 => !!pos);
}

export function getGiveFlagTargets(
    localPlayer: Player | undefined,
    localId: string | null,
    adjacentPlayers: Player[],
    playerPositions: Record<string, Vec2>,
    teams: Player[][],
): Vec2[] {
    if (!localPlayer?.hasFlag || !localId) return [];
    return adjacentPlayers
        .filter(p => {
            const isSameTeam = teams.some(team =>
                team.some(t => t.socketId === localId) &&
                team.some(t => t.socketId === p.socketId),
            );
            return isSameTeam;
        })
        .map(p => playerPositions[p.socketId])
        .filter((pos): pos is Vec2 => !!pos);
}

export function getPlayerAtPosition(x: number, y: number, playerPositions: Record<string, Vec2>): string | null {
    for (const [socketId, pos] of Object.entries(playerPositions)) {
        if (pos.x === x && pos.y === y) return socketId;
    }
    return null;
}

export function getPlayerAvatar(socketId: string, players: Player[]): string | undefined {
    return players.find((player) => player.socketId === socketId)?.character?.avatar;
}

export function getPlayerName(socketId: string, players: Player[]): string {
    return players.find((player) => player.socketId === socketId)?.character?.name ?? 'Un joueur';
}

export function getTimerLabel(activeId: string | null, localId: string | null, players: Player[]): string {
    if (!activeId) return 'Prochain tour...';
    const name = getPlayerName(activeId, players);
    return activeId === localId ? 'Votre tour' : `Tour de ${name}`;
}

export function getTimerDisplay(countdown: number, activeId: string | null): string {
    if (!activeId) return `00:0${countdown}`;
    const TEN = 10;
    return `00:${countdown < TEN ? '0' : ''}${countdown}`;
}
