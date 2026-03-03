import { Game } from '@common/game';
import { Injectable } from '@nestjs/common';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';

@Injectable()
export class LobbyService {
    constructor() {
        this.lobbies = new Map<string, Lobby>();
    }

    private lobbies: Map<string, Lobby>;

    createLobby(game: Game, hostSocketId: string, player: Player) : Lobby {
        const gameId = game._id.toString();
        const lobby: Lobby = {
            gameId,
            game,
            hostSocketId,
            playerCount: 1,
            isLocked: false,
            players: [player],
        };

        this.lobbies.set(gameId, lobby);
        return lobby;
    }

    getLobby(gameId: string) : Lobby | undefined {
        return this.lobbies.get(gameId);
    }

    getAvailableLobbies() : Lobby[] {
        const availableLobbies = Array.from(this.lobbies.values()).filter(
            lobby => lobby.isLocked === false && lobby.playerCount < lobby.game.maxPlayers);

        return availableLobbies;
    }

    joinLobby(gameId: string, player: Player) : Lobby {
        const lobby = this.lobbies.get(gameId);
        if (!lobby) throw new Error('There is no lobby associated with the provided ID');
        if (lobby.isLocked === true) throw new Error('The lobby is locked');

        lobby.players.push(player);
        lobby.playerCount++;
        if (lobby.playerCount === lobby.game.maxPlayers) lobby.isLocked = true;
        return lobby;
    }

    deleteLobby(gameId) : void {
        this.lobbies.delete(gameId);
    }

    findLobbyBySocketId(socketId: string) : Lobby | undefined {
        const hostLobby = Array.from(this.lobbies.values()).find(lobby => lobby.hostSocketId === socketId);
        return hostLobby;
    }

    removePlayerFromLobby(gameId: string, socketId: string) : void {
        const lobby = this.lobbies.get(gameId);
        if (lobby) {
            lobby.players = lobby.players.filter(player => player.socketId !== socketId);
        }
    }
}