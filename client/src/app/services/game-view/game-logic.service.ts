import { Injectable } from '@angular/core';
import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { TEN } from '@app/services/game-view/game-view.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { PlayerAction, TileItem, TileTexture } from '@common/enums';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import { getSanctuaryCanonicalInfo, getSanctuaryTargets } from './game-sanctuary.utils';
import { getTileDebuff, expandSanctuaryPositions } from './game-lobby.utils';

export interface TileClickContext {
    lobbyId: string;
    currentPlayer: Player;
    targetPlayer?: Player;
    targetSocketId?: string;
}

export interface ActionHighlightParams {
    isSubMenuOpen: boolean;
    activeSubAction: ActionHighlightType | null;
    attackTargets: Vec2[];
    requestFlagTargets: Vec2[];
    giveFlagTargets: Vec2[];
    adjacentDoorTiles: Vec2[];
    sanctuaryTargets: Vec2[];
}

export interface HasAnyActionParams {
    isMyTurn: boolean;
    actionPoints: number;
    attackTargets: Vec2[];
    requestFlagTargets: Vec2[];
    giveFlagTargets: Vec2[];
    adjacentDoorTiles: Vec2[];
    sanctuaryTargets: Vec2[];
}

@Injectable({
    providedIn: 'root',
})
export class GameLogicService {
    isPlayerInTeam(team: Player[], socketId: string): boolean {
        return team.some((player) => player.socketId === socketId);
    }

    arePlayersTeammates(localSocketId: string, targetSocketId: string, teams: Player[][]): boolean {
        return teams.some(
            (team) => this.isPlayerInTeam(team, localSocketId) && this.isPlayerInTeam(team, targetSocketId),
        );
    }

    getAdjacentPlayerPositions(adjacentPlayers: Player[], playerPositions: Record<string, Vec2>): Vec2[] {
        return adjacentPlayers
            .map((player) => playerPositions[player.socketId])
            .filter((position): position is Vec2 => Boolean(position));
    }

    getTeamPlayers(team: 'A' | 'B', lobby: Lobby | null, orderedPlayers: Player[] | null): Player[] {
        if (!lobby || !orderedPlayers) return [];

        const selectedTeam = team === 'A' ? lobby.teamA : lobby.teamB;
        return orderedPlayers.filter((player) => selectedTeam.some((p) => p.socketId === player.socketId));
    }

    getAttackTargets(localId: string | undefined, adjacentPlayers: Player[], playerPositions: Record<string, Vec2>, teams: Player[][]): Vec2[] {
        if (!localId) return [];
        const enemies = adjacentPlayers.filter((player) => !this.arePlayersTeammates(localId, player.socketId, teams));
        return this.getAdjacentPlayerPositions(enemies, playerPositions);
    }

    getRequestFlagTargets(
        localPlayer: Player | undefined, adjacentPlayers: Player[], playerPositions: Record<string, Vec2>, teams: Player[][],
    ): Vec2[] {
        if (!localPlayer || localPlayer.hasFlag) return [];
        const teammatesWithFlag = adjacentPlayers.filter(
            (player) => this.arePlayersTeammates(localPlayer.socketId, player.socketId, teams) && player.hasFlag,
        );
        return this.getAdjacentPlayerPositions(teammatesWithFlag, playerPositions);
    }

    getGiveFlagTargets(localPlayer: Player | undefined, adjacentPlayers: Player[], playerPositions: Record<string, Vec2>, teams: Player[][]): Vec2[] {
        if (!localPlayer?.hasFlag) return [];
        const teammates = adjacentPlayers.filter((player) => this.arePlayersTeammates(localPlayer.socketId, player.socketId, teams));
        return this.getAdjacentPlayerPositions(teammates, playerPositions);
    }

    getOrderedPlayers(
        turnOrder: string[],
        players: Player[],
        activeId: string | null,
    ): Player[] {
        if (turnOrder.length === 0) return players;

        const fullList = turnOrder
            .map((socketId) => players.find((player) => player.socketId === socketId))
            .filter((player): player is Player => Boolean(player));

        if (!activeId) return fullList;

        const activeIndex = fullList.findIndex((player) => player.socketId === activeId);
        return activeIndex <= 0 ? fullList : [...fullList.slice(activeIndex), ...fullList.slice(0, activeIndex)];
    }

    getAdjacentPlayers(
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

    getAdjacentDoorTiles(
        isMyTurn: boolean,
        localId: string | undefined,
        positions: Record<string, Vec2>,
        grid: Tile[][] | undefined,
    ): Vec2[] {
        if (!isMyTurn || !localId || !grid) return [];
        const myPos = positions[localId];
        if (!myPos) return [];

        return Object.values(DIRECTION_OFFSETS)
            .map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }))
            .filter(({ x, y }) => {
                const row = grid[y];
                if (!row) return false;
                const tile = row[x];
                if (!tile) return false;
                return tile.type === TileTexture.DoorClosed || tile.type === TileTexture.DoorOpened;
            });
    }

    getSanctuaryCanonicalInfo(
        pos: Vec2,
        context: { item: TileItem; grid: Tile[][]; currentSocketId: string | undefined; positions: Record<string, Vec2> },
    ): { canonicalPos: Vec2; isAdjacent: boolean } {
        return getSanctuaryCanonicalInfo(pos, context);
    }

    getSanctuaryTargets(
        localId: string | undefined,
        positions: Record<string, Vec2>,
        grid: Tile[][],
        inactiveSanctuaries: Vec2[],
    ): Vec2[] {
        return getSanctuaryTargets(localId, positions, grid, inactiveSanctuaries);
    }

    getPlayerAtPosition(x: number, y: number, playerPositions: Record<string, Vec2>): string | null {
        for (const [socketId, position] of Object.entries(playerPositions)) {
            if (position.x === x && position.y === y) {
                return socketId;
            }
        }
        return null;
    }

    getPlayerAvatar(socketId: string, players: Player[]): string | undefined {
        return players.find((player) => player.socketId === socketId)?.character?.avatar;
    }

    getPlayerName(socketId: string, players: Player[]): string {
        return players.find((player) => player.socketId === socketId)?.character?.name ?? 'Un joueur';
    }

    getTimerLabel(activeId: string | null, localId: string | undefined, players: Player[]): string {
        if (!activeId) return 'Prochain tour...';

        const name = this.getPlayerName(activeId, players);
        return activeId === localId ? 'Votre tour' : `Tour de ${name}`;
    }

    getTimerDisplay(countdown: number, activeId: string | null): string {
        if (!activeId) return `00:0${countdown}`;
        return `00:${countdown < TEN ? '0' : ''}${countdown}`;
    }

    buildTileClickContext(args: {
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
        if (!lobbyId || !currentSocketId || !currentPlayer || actionPoints <= 0 || !isHighlighted) return null;

        if (targetSocketId === currentSocketId) return null;

        const targetPlayer = lobby?.players.find((player) => player.socketId === targetSocketId);

        return { lobbyId, currentPlayer, targetPlayer, targetSocketId: targetSocketId ?? undefined };
    }

    getCurrentPlayerIceDebuff(
        currentSocketId: string | undefined,
        positions: Record<string, Vec2>,
        isOnIce: (position: Vec2) => 2 | 0,
    ): 2 | 0 {
        if (!currentSocketId) {
            return 0;
        }
        const currentPosition = positions[currentSocketId];
        if (!currentPosition) {
            return 0;
        }
        return isOnIce(currentPosition);
    }

    getDoorActionLabel(doorTiles: Vec2[], grid: Tile[][] | undefined): string {
        if (doorTiles.length === 0 || !grid) return 'Porte';
        const firstDoor = doorTiles[0];
        const isClosed = grid[firstDoor.y]?.[firstDoor.x]?.type === TileTexture.DoorClosed;
        return isClosed ? 'Ouvrir porte' : 'Fermer porte';
    }

    getActionHighlightTiles(params: ActionHighlightParams): ActionTileHighlight[] {
        const {
            isSubMenuOpen, activeSubAction, attackTargets,
            requestFlagTargets, giveFlagTargets, adjacentDoorTiles, sanctuaryTargets,
        } = params;

        if (!isSubMenuOpen || !activeSubAction) {
            return [];
        }
        const typeMap: Record<ActionHighlightType, Vec2[]> = {
            [PlayerAction.Attack]: attackTargets,
            [PlayerAction.RequestFlag]: requestFlagTargets,
            [PlayerAction.GiveFlag]: giveFlagTargets,
            [PlayerAction.ToggleDoor]: adjacentDoorTiles,
            [PlayerAction.Sanctuary]: sanctuaryTargets,
        };
        return (typeMap[activeSubAction] ?? []).map((pos) => ({ pos, type: activeSubAction }));
    }

    checkHasAnyAction(params: HasAnyActionParams): boolean {
        const {
            isMyTurn, actionPoints, attackTargets, requestFlagTargets,
            giveFlagTargets, adjacentDoorTiles, sanctuaryTargets,
        } = params;

        if (!isMyTurn || actionPoints <= 0) {
            return false;
        }

        return (
            attackTargets.length > 0 ||
            requestFlagTargets.length > 0 ||
            giveFlagTargets.length > 0 ||
            adjacentDoorTiles.length > 0 ||
            sanctuaryTargets.length > 0
        );
    }

    getTileDebuff(grid: Lobby['game']['grid'], pos: Vec2): 2 | 0 {
        return getTileDebuff(grid, pos);
    }

    expandSanctuaryPositions(topLeftList: Vec2[]): Vec2[] {
        return expandSanctuaryPositions(topLeftList);
    }
}
