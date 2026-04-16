import { ChatMessage } from '@common/chat-message';
import { HISTORY_MAX_MESSAGE } from '@common/constants/validation.constants';
import { DiceType, GameMode, PlayerType, VirtualPlayerProfile } from '@common/enums';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Injectable } from '@nestjs/common';
import { AVATARS_PATH, RANDOM_NAMES, BASE_STATS, RANDOM_PROBABILITY } from '@common/constants/character.constants';
import { Character } from '@common/character';
import { TeamPair } from '@app/interfaces/game-logic.interface';


const ALPHANUMERIC_BASE = 36;
const ID_SUBSTRING_START = 2;
const ID_SUBSTRING_END = 7;
const ID_PADDING_LENGTH = 5;
const DUPLICATE_NAME_SUFFIX_START = 2;
const VIRTUAL_PLAYER_ID_BASE = 1000;
const AVATAR_ALREADY_TAKEN_ERROR = 'Avatar already taken';
const HALF_CHANCE = 0.5;

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
            teamA: [],
            teamB: [],
        };

        this.lobbies.set(lobbyId, lobby);
        return lobby;
    }

    getLobby(lobbyId: string): Lobby | undefined {
        return this.lobbies.get(lobbyId);
    }

    private createTeams(lobbyId: string): TeamPair {
        const lobby = this.getLobby(lobbyId);
        if (lobby.game.gameMode !== GameMode.Ctf || lobby.playerCount % 2 !== 0) return null;

        const randomPlayers = [...lobby.players].sort(() => Math.random() - HALF_CHANCE);
        const teamA = [...randomPlayers].slice(0, randomPlayers.length / 2);
        const teamB = [...randomPlayers].slice(randomPlayers.length / 2);
        return { teamA, teamB };
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

        const requestedAvatar = player.character?.avatar;
        if (requestedAvatar && this.isAvatarOccupiedByAnother(lobby, requestedAvatar, player.socketId)) {
            throw new Error(AVATAR_ALREADY_TAKEN_ERROR);
        }

        if (player.socketId) {
            delete lobby.pendingAvatars[player.socketId];
        }

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
            const wasFullBeforeLeave = lobby.playerCount === lobby.game.maxPlayers;
            lobby.players = lobby.players.filter((player) => player.socketId !== socketId);
            delete lobby.pendingAvatars[socketId];
            lobby.playerCount = lobby.players.length;
            lobby.teamA = lobby.teamA.filter(p => p.socketId !== socketId);
            lobby.teamB = lobby.teamB.filter(p => p.socketId !== socketId);

            if (wasFullBeforeLeave && lobby.playerCount < lobby.game.maxPlayers) {
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

    canStartGame(lobbyId: string, hostSocketId: string): Lobby | null {
        const lobby = this.getLobby(lobbyId);

        if (lobby && lobby.hostSocketId === hostSocketId && lobby.playerCount >= 2) {
            if (lobby.game.gameMode === GameMode.Ctf) {
                const teams = this.createTeams(lobbyId);
                if (!teams) return null;
                lobby.teamA = teams.teamA;
                lobby.teamB = teams.teamB;
            }

            lobby.isLocked = true;
            return lobby;
        }
        return null;
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

    addVirtualPlayerToLobby(lobbyId: string, profile: VirtualPlayerProfile): Lobby {
        const lobby = this.getLobby(lobbyId);
        if (!lobby) throw new Error('There is no lobby associated with the provided ID');

        const allUnavailableAvatars = this.getOccupiedAvatars(lobby);
        const availableAvatars = AVATARS_PATH.filter(
            (avatar) => !allUnavailableAvatars.includes(avatar),
        );

        let randomAvatar: string;

        if (availableAvatars.length > 0) {
            const randomAvatarIndex: number = Math.floor(Math.random() * availableAvatars.length);
            randomAvatar = availableAvatars[randomAvatarIndex];
        } else {
            const pendingAvatarEntries = Object.entries(lobby.pendingAvatars || {});
            const randomPendingIndex = Math.floor(Math.random() * pendingAvatarEntries.length);
            const [socketIdToUnselect, avatar] = pendingAvatarEntries[randomPendingIndex];
            randomAvatar = avatar;
            delete lobby.pendingAvatars[socketIdToUnselect];
        }

        const availableName = this.getAvailableVirtualPlayerName(lobby);

        const lifeBonus: boolean = Math.random() < RANDOM_PROBABILITY;
        const attackDiceD6: boolean = Math.random() < RANDOM_PROBABILITY;

        const lifeValue = BASE_STATS.life + (lifeBonus ? BASE_STATS.bonus : 0);
        const speedValue = BASE_STATS.speed + (!lifeBonus ? BASE_STATS.bonus : 0);

        const character: Character = {
            name: availableName,
            avatar: randomAvatar,
            life: lifeValue,
            speed: speedValue,
            attack: BASE_STATS.attack,
            defense: BASE_STATS.defense,
            lifeBonus,
            attackDice: attackDiceD6 ? DiceType.D6 : DiceType.D4,
            defenseDice: attackDiceD6 ? DiceType.D4 : DiceType.D6,
        };
        const virtualPlayer: Player = {
            socketId: `virtual-${Date.now()}-${Math.floor(Math.random() * VIRTUAL_PLAYER_ID_BASE)}`,
            character,
            isHost: false,
            winsCount: 0,
            hasAbandonned: false,
            playerType: PlayerType.Virtual,
            virtualProfile: profile,
            hasFlag: false,
            combatCount: 0,
            lossCount: 0,
            totalHpLost: 0,
            totalHpDealt: 0,
            visitedTilesCount: 0,
        };

        const updatedLobby = this.joinLobby(lobbyId, virtualPlayer);
        return updatedLobby;
    }

    initializeRealPlayer(player: Player, socketId: string, isHost: boolean): void {
        player.socketId = socketId;
        player.isHost = isHost;
        player.winsCount = 0;
        player.hasAbandonned = false;
        player.playerType = PlayerType.Reel;
        player.combatCount = 0;
        player.lossCount = 0;
        player.totalHpLost = 0;
        player.totalHpDealt = 0;
        player.visitedTilesCount = 0;
    }

    private isAvatarOccupiedByAnother(lobby: Lobby, avatar: string, socketId: string | null): boolean {
        const isTakenByConfirmedPlayer = lobby.players.some(
            (existingPlayer) => existingPlayer.socketId !== socketId && existingPlayer.character?.avatar === avatar,
        );
        
        if (isTakenByConfirmedPlayer) {
            return true;
        }
        
        return Object.entries(lobby.pendingAvatars || {}).some(
            ([pendingSocketId, pendingAvatar]) => pendingSocketId !== socketId && pendingAvatar === avatar,
        );
    }

    getOccupiedAvatars(lobby: Lobby): string[] {
        const confirmedAvatars = lobby.players
            .map((player) => player.character?.avatar)
            .filter((avatar): avatar is string => avatar !== undefined && avatar !== null && avatar !== '');

        const pendingAvatars = Object.values(lobby.pendingAvatars || {});
        return [...confirmedAvatars, ...pendingAvatars];
    }

    getValidName(name: string, lobby: Lobby): string {
        let finalName = name;
        let counter = DUPLICATE_NAME_SUFFIX_START;
        while (lobby.players.some((player) => player.character.name === finalName)) {
            finalName = `${name}-${counter}`;
            counter++;
        }

        return finalName;
    }

    private getAvailableVirtualPlayerName(lobby: Lobby): string {
        const usedNames = new Set(lobby.players.map((player) => player.character.name));
        let randomName: string;
        
        do {
            const randomNameIndex = Math.floor(Math.random() * RANDOM_NAMES.length);
            randomName = RANDOM_NAMES[randomNameIndex];
        } while (usedNames.has(randomName));
        
        return randomName;
    }

    getLobbyValidationError(lobby: Lobby | undefined): string | undefined {
        if (!lobby) {
            return `Ce salon n'existe plus.`;
        }

        if (lobby.playerCount >= lobby.game.maxPlayers) {
            return 'Ce salon est plein !';
        }

        if (lobby.isLocked) {
            return 'Ce salon est verrouillé !';
        }

        return undefined;
    }
}
