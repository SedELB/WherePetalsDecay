import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { DIRECTION_OFFSETS } from '@common/direction';
import { TileItem } from '@common/enums';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

const TEN = 10;

export interface TileClickContext {
    lobbyId: string;
    currentPlayer: Player;
    targetPlayer: Player;
    targetSocketId: string;
}

export function isPlayerInTeam(team: Player[], socketId: string): boolean {
    return team.some((player) => player.socketId === socketId);
}

export function arePlayersTeammates(localSocketId: string, targetSocketId: string, teams: Player[][]): boolean {
    return teams.some(
        (team) => isPlayerInTeam(team, localSocketId) && isPlayerInTeam(team, targetSocketId),
    );
}

export function getAdjacentPlayerPositions(adjacentPlayers: Player[], playerPositions: Record<string, Vec2>): Vec2[] {
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

export function getTimerLabel(activeId: string | null, localId: string | undefined, players: Player[]): string {
    if (!activeId) return 'Prochain tour...';

    const name = getPlayerName(activeId, players);
    return activeId === localId ? 'Votre tour' : `Tour de ${name}`;
}

export function getTimerDisplay(countdown: number, activeId: string | null): string {
    if (!activeId) return `00:0${countdown}`;
    return `00:${countdown < TEN ? '0' : ''}${countdown}`;
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

export function getOrderedPlayers(
    turnOrder: string[], 
    players: Player[], 
    activeId: string | null,
): Player[] {
    if (!turnOrder.length) return players;

    const fullList = turnOrder
        .map((socketId) => players.find((player) => player.socketId === socketId))
        .filter((player): player is Player => !!player);

    if (!activeId) return fullList;

    const activeIndex = fullList.findIndex((player) => player.socketId === activeId);
    return activeIndex <= 0 ? fullList : [...fullList.slice(activeIndex), ...fullList.slice(0, activeIndex)];
}

export function getAdjacentPlayers(
    isMyTurn: boolean, 
    localId: string | undefined, 
    positions: Record<string, Vec2>, 
    players: Player[],
): Player[] {
    if (!isMyTurn || !localId) return [];
    
    const myPos = positions[localId];
    if (!myPos) return [];

    const adjacent = Object.values(DIRECTION_OFFSETS).map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }));
    return players.filter((player) => {
        if (player.socketId === localId || player.hasAbandonned) return false;
        const pos = positions[player.socketId];
        return !!pos && adjacent.some((a) => a.x === pos.x && a.y === pos.y);
    });
}

export function getSanctuaryTargets(
    localId: string | undefined,
    positions: Record<string, Vec2>,
    grid: Tile[][],
    inactiveSanctuaries: Vec2[],
): Vec2[] {
    if (!localId) return [];
    const myPos = positions[localId];
    if (!myPos) return [];
    const adjacent = Object.values(DIRECTION_OFFSETS).map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }));
    return adjacent.filter((pos) => {
        const tile = grid[pos.y]?.[pos.x];
        if (!tile) return false;
        const isSanctuary = tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary;
        const isInactive = inactiveSanctuaries.some((s) => s.x === pos.x && s.y === pos.y);
        return isSanctuary && !isInactive;
    });
}

export function getActionHighlightTiles(
    isSubMenuOpen: boolean,
    activeSubAction: ActionHighlightType | null,
    attackTargets: Vec2[],
    requestFlagTargets: Vec2[],
    giveFlagTargets: Vec2[],
    sanctuaryTargets: Vec2[],
): ActionTileHighlight[] {
    if (!isSubMenuOpen || !activeSubAction) return [];
    const typeMap: Record<ActionHighlightType, Vec2[]> = {
        attack: attackTargets,
        requestFlag: requestFlagTargets,
        giveFlag: giveFlagTargets,
        sanctuary: sanctuaryTargets,
    };
    return (typeMap[activeSubAction] ?? []).map((pos) => ({ pos, type: activeSubAction }));
}

export function checkHasAnyAction(
    isMyTurn: boolean,
    actionPoints: number,
    attackTargets: Vec2[],
    requestFlagTargets: Vec2[],
    giveFlagTargets: Vec2[],
    sanctuaryTargets: Vec2[],
): boolean {
    if (!isMyTurn) return false;
    const hasPaidAction = actionPoints > 0 && (attackTargets.length > 0 || requestFlagTargets.length > 0 || giveFlagTargets.length > 0);
    return hasPaidAction || sanctuaryTargets.length > 0;
}