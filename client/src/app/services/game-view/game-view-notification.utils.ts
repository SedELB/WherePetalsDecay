import { Lobby } from '@common/lobby';

export function getNextTurnNotification(
    order: string[],
    lobby: Lobby | null,
    endedPlayerSocketId: string,
    localSocketId: string | undefined,
): string | null {
    if (!lobby || order.length === 0) return null;

    const activePlayers = lobby.players.filter((player) => !player.hasAbandonned);
    const endedIndex = order.indexOf(endedPlayerSocketId);
    if (endedIndex === -1) return null;

    for (let i = 1; i <= order.length; i++) {
        const candidateId = order[(endedIndex + i) % order.length];
        const candidate = activePlayers.find((player) => player.socketId === candidateId);
        if (!candidate) continue;

        const isLocal = candidateId === localSocketId;
        return isLocal ? 'C\'est bientôt votre tour !' : `C'est bientôt le tour de ${candidate.character.name}`;
    }

    return null;
}

export function getFirstTurnNotification(order: string[], lobby: Lobby, localSocketId: string | undefined): string | null {
    if (order.length === 0 || !lobby.players.length) return null;

    const firstPlayer = lobby.players.find((player) => player.socketId === order[0]);
    if (!firstPlayer) return null;

    const isLocal = order[0] === localSocketId;
    return isLocal ? 'C\'est bientôt votre tour !' : `C'est bientôt le tour de ${firstPlayer.character.name}`;
}
