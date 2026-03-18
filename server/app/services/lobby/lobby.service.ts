import { HISTORY_MAX_MESSAGE } from '@common/constants/validation.constants';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { Injectable } from '@nestjs/common';
import { Player } from '@common/player';
import { ChatMessage } from '@common/chat-message';

const ALPHANUMERIC_BASE = 36;
const ID_SUBSTRING_START = 2;
const ID_SUBSTRING_END = 7;
const ID_PADDING_LENGTH = 5;

@Injectable()
export class LobbyService {
    constructor() {
        this.lobbies = new Map<string, Lobby>();
    }

    private lobbies: Map<string, Lobby>;

    private generateLobbyId(): string {
        let newLobbyId: string;
        do {
            newLobbyId = Math.random()
                .toString(ALPHANUMERIC_BASE)
                .substring(ID_SUBSTRING_START, ID_SUBSTRING_END)
                .padEnd(ID_PADDING_LENGTH, 'X')
                .toUpperCase();
        } while (this.lobbies.has(newLobbyId));

        return newLobbyId;
    }

    createLobby(game: Game, hostSocketId: string, player: Player): Lobby {
        const gameId = game._id.toString();
        const lobbyId = this.generateLobbyId();

        const lobby: Lobby = {
            lobbyId,
            gameId,
            game,
            hostSocketId,
            playerCount: 1,
            isLocked: false,
            players: [player],
            pendingAvatars: {},
            chatHistory: [],
        };

        this.lobbies.set(lobbyId, lobby);
        return lobby;
    }

    getLobby(lobbyId: string): Lobby | undefined {
        return this.lobbies.get(lobbyId);
    }

    getAvailableLobbies(): Lobby[] {
        const availableLobbies = Array.from(this.lobbies.values()).filter(
            (lobby) => !lobby.isLocked && lobby.playerCount < lobby.game.maxPlayers,
        );

        return availableLobbies;
    }

    joinLobby(lobbyId: string, player: Player): Lobby {
        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) throw new Error('There is no lobby associated with the provided ID');
        if (lobby.isLocked) throw new Error('The lobby is locked');

        lobby.players.push(player);
        lobby.playerCount = lobby.players.length;
        if (lobby.playerCount === lobby.game.maxPlayers) lobby.isLocked = true;
        return lobby;
    }

    deleteLobby(lobbyId: string): void {
        this.lobbies.delete(lobbyId);
    }

    findLobbyBySocketId(socketId: string): Lobby | undefined {
        for (const lobby of this.lobbies.values()) {
            if (lobby.hostSocketId === socketId) return lobby;
            if (lobby.players.some((p) => p.socketId === socketId)) return lobby;
            if (Object.keys(lobby.pendingAvatars).includes(socketId)) return lobby;
        }

        return undefined;
    }

    removePlayerFromLobby(lobbyId: string, socketId: string): void {
        const lobby = this.lobbies.get(lobbyId);
        if (lobby) {
            lobby.players = lobby.players.filter((player) => player.socketId !== socketId);
            delete lobby.pendingAvatars[socketId];
            lobby.playerCount = lobby.players.length;

            if (lobby.playerCount < lobby.game.maxPlayers) {
                lobby.isLocked = false;
            }
        }
    }

    updatePlayerAvatar(lobbyId: string, socketId: string, avatarPath: string | null): void {
        const lobby = this.getLobby(lobbyId);
        if (!lobby) return;

        const player = lobby.players.find((p) => p.socketId === socketId);

        if (player && player.character) {
            if (avatarPath) player.character.avatar = avatarPath;
        } else {
            if (!avatarPath) {
                delete lobby.pendingAvatars[socketId];
            } else {
                lobby.pendingAvatars[socketId] = avatarPath;
            }
        }
    }

    toggleLock(lobbyId: string, hostSocketId: string): Lobby | undefined {
        const lobby = this.getLobby(lobbyId);
        if (lobby && lobby.hostSocketId === hostSocketId) {
            lobby.isLocked = !lobby.isLocked;
            return lobby;
        }

        return undefined;
    }

    saveMessage(lobbyId: string, message: ChatMessage): void {
        const lobby = this.getLobby(lobbyId);
        if (!lobby) return;

        lobby.chatHistory.push(message);

        if (lobby.chatHistory.length > HISTORY_MAX_MESSAGE) {
            lobby.chatHistory.shift();
        }
    }

    canStartGame(lobbyId: string, hostSocketId: string): Lobby | undefined {
        const lobby = this.getLobby(lobbyId);

        if (lobby && lobby.hostSocketId === hostSocketId && lobby.playerCount >= 2) {
            lobby.isLocked = true;
            return lobby;
        }
        return undefined;
    }

    kickPlayer(lobbyId: string, hostSocketId: string, targetSocketId: string): boolean {
        const lobby = this.getLobby(lobbyId);
        if (lobby && lobby.hostSocketId === hostSocketId) {
            this.removePlayerFromLobby(lobbyId, targetSocketId);
            return true;
        }

        return false;
    }

    abandonPlayer(lobbyId: string, socketId: string): Lobby | undefined {
        const lobby = this.getLobby(lobbyId);
        if (!lobby) return undefined;
        const player = lobby.players.find((p) => p.socketId === socketId);
        if (player) player.hasAbandonned = true;
        return lobby;
    }
}
