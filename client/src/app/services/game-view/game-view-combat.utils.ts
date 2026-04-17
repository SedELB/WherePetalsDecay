import { DEFAULT_COMBAT_POSTURE } from '@app/services/game-view/game-view.constants';
import { CombatEndedData, CombatStartedData } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Lobby } from '@common/lobby';
import { Debuf } from '@common/character';
import { CombatMessageContext } from '@app/interfaces/combat.interfaces';
import { getTileDebuff } from './game-lobby.utils';

export const getCombatantName = (players: Player[], socketId: string | null, fallback: string): string => {
    if (!socketId) return fallback;
    return players.find((player) => player.socketId === socketId)?.character.name ?? fallback;
};

export const getLoserSocketId = (data: CombatEndedData): string | null => {
    if (data.winnerId === data.attackerSocketId) return data.defenderSocketId;
    if (data.winnerId === data.defenderSocketId) return data.attackerSocketId;
    return null;
};

export const buildCombatEndedMessageContext = (
    data: CombatEndedData,
    players: Player[],
    localId: string | undefined,
): CombatMessageContext => {
    const attackerName = getCombatantName(players, data.attackerSocketId, 'Attaquant');
    const defenderName = getCombatantName(players, data.defenderSocketId, 'Défenseur');
    const winnerName = data.winnerId ? getCombatantName(players, data.winnerId, 'Un joueur') : 'Un joueur';
    const loserSocketId = getLoserSocketId(data);
    const loserName = loserSocketId === data.attackerSocketId ? attackerName : defenderName;
    const winnerIsLocal = !!localId && data.winnerId === localId;
    const loserIsLocal = !!localId && loserSocketId === localId;

    return {
        winnerIsLocal,
        loserIsLocal,
        winnerDisplayName: winnerIsLocal ? 'Vous' : winnerName,
        loserDisplayName: loserIsLocal ? 'Vous' : loserName,
    };
};

export const buildAbandonMessage = (context: CombatMessageContext): string => {
    const abandonMessage = context.loserIsLocal ? 'Vous avez abandonné.' : `${context.loserDisplayName} a abandonné.`;
    const winnerMessage = context.winnerIsLocal ? 'Vous gagnez le combat.' : `${context.winnerDisplayName} gagne le combat.`;
    return `${abandonMessage} ${winnerMessage}`;
};

export const buildDeathMessage = (context: CombatMessageContext): string => {
    const deathMessage = context.loserIsLocal ? 'Vous êtes mort.' : `${context.loserDisplayName} est mort.`;
    const winnerMessage = context.winnerIsLocal ? 'Vous gagnez le combat.' : `${context.winnerDisplayName} gagne le combat.`;
    return `${deathMessage} ${winnerMessage}`;
};

export const buildCombatEndedMessage = (data: CombatEndedData, players: Player[], localId: string | undefined): string => {
    if (data.attackerKilled && data.defenderKilled) {
        return 'Double K.O. Aucun gagnant du combat.';
    }

    const context = buildCombatEndedMessageContext(data, players, localId);
    if (data.reason === 'abandon') {
        return buildAbandonMessage(context);
    }

    if (data.winnerId) {
        return buildDeathMessage(context);
    }

    return 'Combat terminé.';
};

export const resolveCombatStartIceDebuff = (
    socketId: string,
    fallbackDebuff: Debuf | undefined,
    playerPositions: Record<string, Vec2>,
    gameGrid: Lobby['game']['grid'] | undefined,
): Debuf => {
    const position = playerPositions[socketId];
    if (!position || !gameGrid) return fallbackDebuff ?? 0;
    return getTileDebuff(gameGrid, position);
};

export const buildCombatStartData = (
    localPlayerData: CombatStartedData,
    playerPositions: Record<string, Vec2>,
    gameGrid: Lobby['game']['grid'] | undefined,
): CombatStartedData => {
    const playerDebuff = resolveCombatStartIceDebuff(
        localPlayerData.player.socketId,
        localPlayerData.player.character.debuf,
        playerPositions,
        gameGrid,
    );

    const enemyDebuff = resolveCombatStartIceDebuff(
        localPlayerData.enemy.socketId,
        localPlayerData.enemy.character.debuf,
        playerPositions,
        gameGrid,
    );

    return {
        roomId: localPlayerData.roomId,
        player: {
            ...localPlayerData.player,
            character: {
                ...localPlayerData.player.character,
                bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                debuf: playerDebuff,
            },
        },
        enemy: {
            ...localPlayerData.enemy,
            character: {
                ...localPlayerData.enemy.character,
                bonusPosture: { ...DEFAULT_COMBAT_POSTURE },
                debuf: enemyDebuff,
            },
        },
    };
};
