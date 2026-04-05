import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';

function isPlayerInTeam(team: Player[], socketId: string): boolean {
    return team.some((player) => player.socketId === socketId);
}

function arePlayersTeammates(localSocketId: string, targetSocketId: string, teams: Player[][]): boolean {
    return teams.some(
        (team) => isPlayerInTeam(team, localSocketId) && isPlayerInTeam(team, targetSocketId),
    );
}

function getAdjacentPlayerPositions(adjacentPlayers: Player[], playerPositions: Record<string, Vec2>): Vec2[] {
    return adjacentPlayers
        .map((player) => playerPositions[player.socketId])
        .filter((position): position is Vec2 => Boolean(position));
}

export function getTeamPlayers(team: 'A' | 'B', lobby: Lobby | null, orderedPlayers: Player[] | null): Player[] {
    if (!lobby || !orderedPlayers) return [];

    const selectedTeam = team === 'A' ? lobby.teamA : lobby.teamB;
    return orderedPlayers.filter((player) => selectedTeam.some((p) => p.socketId === player.socketId));
}

export function getAttackTargets(
    localId: string | undefined,
    adjacentPlayers: Player[],
    playerPositions: Record<string, Vec2>,
    teams: Player[][],
): Vec2[] {
    if (!localId) return [];

    const enemies = adjacentPlayers.filter(
        (player) => !arePlayersTeammates(localId, player.socketId, teams),
    );

    return getAdjacentPlayerPositions(enemies, playerPositions);
}

export function getRequestFlagTargets(
    localPlayer: Player | undefined,
    adjacentPlayers: Player[],
    playerPositions: Record<string, Vec2>,
    teams: Player[][],
): Vec2[] {
    if (!localPlayer || localPlayer.hasFlag) return [];

    const teammatesWithFlag = adjacentPlayers.filter(
        (player) =>
            arePlayersTeammates(localPlayer.socketId, player.socketId, teams) && player.hasFlag,
    );

    return getAdjacentPlayerPositions(teammatesWithFlag, playerPositions);
}

export function getGiveFlagTargets(
    localPlayer: Player | undefined,
    adjacentPlayers: Player[],
    playerPositions: Record<string, Vec2>,
    teams: Player[][],
): Vec2[] {
    if (!localPlayer?.hasFlag) return [];

    const teammates = adjacentPlayers.filter((player) =>
        arePlayersTeammates(localPlayer.socketId, player.socketId, teams),
    );

    return getAdjacentPlayerPositions(teammates, playerPositions);
}

export function getPlayerAtPosition(x: number, y: number, playerPositions: Record<string, Vec2>): string | null {
    for (const [socketId, position] of Object.entries(playerPositions)) {
        if (position.x === x && position.y === y) return socketId;
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