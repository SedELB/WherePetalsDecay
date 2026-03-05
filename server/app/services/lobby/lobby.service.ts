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
            pendingAvatars: {},
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
        lobby.playerCount = lobby.players.length;
        if (lobby.playerCount === lobby.game.maxPlayers) lobby.isLocked = true;
        return lobby;
    }

    deleteLobby(gameId) : void {
        this.lobbies.delete(gameId);
    }

    findLobbyBySocketId(socketId: string) : Lobby | undefined {
        return Array.from(this.lobbies.values()).find(lobby => 
        lobby.hostSocketId === socketId || 
        lobby.players.some(player => player.socketId === socketId));
    }

    removePlayerFromLobby(gameId: string, socketId: string) : void {
        const lobby = this.lobbies.get(gameId);
        if (lobby) {
            lobby.players = lobby.players.filter(player => player.socketId !== socketId);
            delete lobby.pendingAvatars[socketId];
            lobby.playerCount = lobby.players.length;

            if (lobby.playerCount < lobby.game.maxPlayers) {
                lobby.isLocked = false;
            }
        }
    }

    updatePlayerAvatar(gameId: string, socketId: string, avatarPath: string | null): void {
        const lobby = this.getLobby(gameId);
        if (!lobby) return;

        const player = lobby.players.find(p => p.socketId === socketId);

        if (player && player.character) {
            if (avatarPath) player.character.avatar = avatarPath;
        } else {
            if (!avatarPath){
                delete lobby.pendingAvatars[socketId];
            } else {
                lobby.pendingAvatars[socketId] = avatarPath;
            }
        }
    }
}