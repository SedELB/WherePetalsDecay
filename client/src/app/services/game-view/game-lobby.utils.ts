import { ICE_DEBUFF, NO_DEBUFF, SANCTUARY_BLOCK_SIZE } from '@app/services/game-view/game-view.constants';
import { TileItem, TileTexture } from '@common/enums';
import { CombatResult } from '@common/interfaces/game-view';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';

export const applyFlagPickup = (lobby: Lobby, socketId: string, position?: Vec2): Lobby => {
    const updatedLobby = { ...lobby };
    const player = updatedLobby.players.find((p) => p.socketId === socketId);
    if (player) player.hasFlag = true;

    if (position) {
        updatedLobby.game.grid = updatedLobby.game.grid.map((row, y) =>
            y === position.y ? row.map((tile, x) => (x === position.x ? { ...tile, item: null } : tile)) : row,
        );
    }
    return updatedLobby;
};

export const toggleDoor = (lobby: Lobby, position: Vec2): Lobby => {
    const updatedLobby = { ...lobby };
    const tile = updatedLobby.game.grid[position.y][position.x];
    tile.type = tile.type === TileTexture.DoorClosed ? TileTexture.DoorOpened : TileTexture.DoorClosed;
    return updatedLobby;
};

export const updatePlayerStats = (lobby: Lobby, playerStats: Player[]): Lobby => {
    const updatedLobby = { ...lobby };
    updatedLobby.players = updatedLobby.players.map((p) => {
        const stats = playerStats.find((s) => s.socketId === p.socketId);
        return stats ? { ...p, ...stats } : p;
    });
    return updatedLobby;
};

export const removePlayerFromLobby = (lobby: Lobby, socketId: string): Lobby => {
    const updatedLobby = { ...lobby };
    updatedLobby.players = updatedLobby.players.map((p) =>
        p.socketId === socketId ? { ...p, hasAbandonned: true } : p,
    );
    return updatedLobby;
};

export const getTileDebuff = (grid: Lobby['game']['grid'], pos: Vec2): 2 | 0 => {
    const tile = grid[pos.y]?.[pos.x];
    if (!tile) return NO_DEBUFF;
    return tile.type === TileTexture.Ice ? ICE_DEBUFF : NO_DEBUFF;
};

export const updateLobbyFromCombatResult = (lobby: Lobby, result: CombatResult, shouldUpdateLifeParam: boolean = true): Lobby => {
    const lifeBySocketId = shouldUpdateLifeParam
        ? new Map<string, number>([
            [result.attacker.socketId, result.attacker.lifeAfter],
            [result.defender.socketId, result.defender.lifeAfter],
        ])
        : new Map<string, number>();

    const updatedPlayers = lobby.players.map((player) => {
        const nextLife = lifeBySocketId.get(player.socketId);
        const shouldDropFlag = Boolean(result.winnerId) && player.socketId === result.loserId;
        const isLifeUpdated = nextLife !== undefined;

        if (!shouldDropFlag && !isLifeUpdated) return player;

        return {
            ...player,
            ...(shouldDropFlag ? { hasFlag: false } : {}),
            ...(isLifeUpdated
                ? {
                    character: {
                        ...player.character,
                        life: Math.max(0, nextLife),
                    },
                }
                : {}),
        };
    });

    return {
        ...lobby,
        players: updatedPlayers,
    };
};

export const updateDroppedFlagFromCombatResult = (lobby: Lobby, result: CombatResult): Lobby => {
    if (!result.winnerId || !result.droppedFlagPosition) return lobby;

    const { x, y } = result.droppedFlagPosition;
    if (!lobby.game.grid[y]?.[x]) return lobby;

    const updatedGrid = lobby.game.grid.map((row, rowIndex) =>
        rowIndex === y ? row.map((tile, colIndex) => (colIndex === x ? { ...tile, item: TileItem.Flag } : tile)) : row,
    );

    return {
        ...lobby,
        game: {
            ...lobby.game,
            grid: updatedGrid,
        },
    };
};

export const processCombatResult = (lobby: Lobby, data: CombatResult): Lobby => {
    let updatedLobby = updateLobbyFromCombatResult(lobby, data);
    updatedLobby = updateDroppedFlagFromCombatResult(updatedLobby, data);
    return updatedLobby;
};

export const processCombatResultWithoutLife = (lobby: Lobby, data: CombatResult): Lobby => {
    let updatedLobby = updateLobbyFromCombatResult(lobby, data, false);
    updatedLobby = updateDroppedFlagFromCombatResult(updatedLobby, data);
    return updatedLobby;
};

export const expandSanctuaryPositions = (topLeftList: Vec2[]): Vec2[] => {
    const expanded: Vec2[] = [];
    for (const tl of topLeftList) {
        for (let dy = 0; dy < SANCTUARY_BLOCK_SIZE; dy++) {
            for (let dx = 0; dx < SANCTUARY_BLOCK_SIZE; dx++) {
                expanded.push({ x: tl.x + dx, y: tl.y + dy });
            }
        }
    }
    return expanded;
};
