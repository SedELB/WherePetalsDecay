import { Injectable } from '@angular/core';
import { ActionHighlightType, ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { ICE_DEBUFF, NO_DEBUFF, SANCTUARY_BLOCK_SIZE, TEN } from '@app/services/game-view/game-view.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { PlayerAction, TileItem, TileTexture } from '@common/enums';
import { CombatResult } from '@common/interfaces/game-view';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

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

    findSanctuaryTopLeft(grid: Tile[][], x: number, y: number, item: TileItem): Vec2 {
        let tlX = x;
        let tlY = y;
        while (grid[tlY - 1]?.[tlX]?.item === item) tlY--;
        while (grid[tlY]?.[tlX - 1]?.item === item) tlX--;
        return { x: tlX, y: tlY };
    }

    getSanctuaryCanonicalInfo(
        pos: Vec2,
        context: { item: TileItem; grid: Tile[][]; currentSocketId: string | undefined; positions: Record<string, Vec2> },
    ): { canonicalPos: Vec2; isAdjacent: boolean } {
        const { item, grid, currentSocketId, positions } = context;
        const tl = this.findSanctuaryTopLeft(grid, pos.x, pos.y, item);
        const myPos = currentSocketId ? positions[currentSocketId] : null;

        if (!myPos) return { canonicalPos: tl, isAdjacent: false };

        const isAdjacent = [{ x: tl.x, y: tl.y }, { x: tl.x + 1, y: tl.y }, { x: tl.x, y: tl.y + 1 }, { x: tl.x + 1, y: tl.y + 1 }].some((c) =>
            Object.values(DIRECTION_OFFSETS).some((o) => myPos.x + o.x === c.x && myPos.y + o.y === c.y),
        );

        return { canonicalPos: tl, isAdjacent };
    }

    private addSanctuaryBlock(results: Vec2[], tl: Vec2): void {
        for (let dy = 0; dy < SANCTUARY_BLOCK_SIZE; dy++) {
            for (let dx = 0; dx < SANCTUARY_BLOCK_SIZE; dx++) {
                results.push({ x: tl.x + dx, y: tl.y + dy });
            }
        }
    }

    getSanctuaryTargets(
        localId: string | undefined,
        positions: Record<string, Vec2>,
        grid: Tile[][],
        inactiveSanctuaries: Vec2[],
    ): Vec2[] {
        if (!localId || !positions[localId]) return [];
        const myPos = positions[localId];
        const results: Vec2[] = [];
        const visitedTopLeft = new Set<string>();
        const adjacent = Object.values(DIRECTION_OFFSETS).map((offset) => ({ x: myPos.x + offset.x, y: myPos.y + offset.y }));

        for (const pos of adjacent) {
            const tile = grid[pos.y]?.[pos.x];
            if (!tile?.item) continue;

            const isSanctuary = tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary;
            const isInactive = inactiveSanctuaries.some((s) => s.x === pos.x && s.y === pos.y);

            if (isSanctuary && !isInactive) {
                const tl = this.findSanctuaryTopLeft(grid, pos.x, pos.y, tile.item as TileItem);
                const key = `${tl.x},${tl.y}`;
                if (!visitedTopLeft.has(key)) {
                    visitedTopLeft.add(key);
                    this.addSanctuaryBlock(results, tl);
                }
            }
        }
        return results;
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

    applyFlagPickup(lobby: Lobby, socketId: string): Lobby {
        const updatedLobby = { ...lobby };
        const player = updatedLobby.players.find((p) => p.socketId === socketId);
        if (player) player.hasFlag = true;
        return updatedLobby;
    }

    toggleDoor(lobby: Lobby, position: Vec2): Lobby {
        const updatedLobby = { ...lobby };
        const tile = updatedLobby.game.grid[position.y][position.x];
        tile.type = tile.type === TileTexture.DoorClosed ? TileTexture.DoorOpened : TileTexture.DoorClosed;
        return updatedLobby;
    }

    updatePlayerStats(lobby: Lobby, playerStats: Player[]): Lobby {
        const updatedLobby = { ...lobby };
        updatedLobby.players = updatedLobby.players.map((p) => {
            const stats = playerStats.find((s) => s.socketId === p.socketId);
            return stats ? { ...p, ...stats } : p;
        });
        return updatedLobby;
    }

    removePlayerFromLobby(lobby: Lobby, socketId: string): Lobby {
        const updatedLobby = { ...lobby };
        updatedLobby.players = updatedLobby.players.map((p) =>
            p.socketId === socketId ? { ...p, hasAbandonned: true } : p,
        );
        return updatedLobby;
    }

    getTileDebuff(grid: Lobby['game']['grid'], pos: Vec2): 2 | 0 {
        const tile = grid[pos.y]?.[pos.x];
        if (!tile) return NO_DEBUFF;
        return tile.type === TileTexture.Ice ? ICE_DEBUFF : NO_DEBUFF;
    }

    expandSanctuaryPositions(topLeftList: Vec2[]): Vec2[] {
        const expanded: Vec2[] = [];
        for (const tl of topLeftList) {
            for (let dy = 0; dy < SANCTUARY_BLOCK_SIZE; dy++) {
                for (let dx = 0; dx < SANCTUARY_BLOCK_SIZE; dx++) {
                    expanded.push({ x: tl.x + dx, y: tl.y + dy });
                }
            }
        }
        return expanded;
    }

    processCombatResult(lobby: Lobby, data: CombatResult): Lobby {
        let updatedLobby = this.updateLobbyFromCombatResult(lobby, data);
        updatedLobby = this.updateDroppedFlagFromCombatResult(updatedLobby, data);
        return updatedLobby;
    }

    updateLobbyFromCombatResult(lobby: Lobby, result: CombatResult): Lobby {
        const updatedLobby = { ...lobby };
        if (result.winnerId) {
            const loser = updatedLobby.players.find((p) => p.socketId === result.loserId);
            if (loser) loser.hasFlag = false;
        }
        return updatedLobby;
    }

    updateDroppedFlagFromCombatResult(lobby: Lobby, result: CombatResult): Lobby {
        const updatedLobby = { ...lobby };
        if (result.winnerId && result.droppedFlagPosition) {
            const { x, y } = result.droppedFlagPosition;
            if (updatedLobby.game.grid[y]?.[x]) updatedLobby.game.grid[y][x].item = TileItem.Flag;
        }
        return updatedLobby;
    }
}
