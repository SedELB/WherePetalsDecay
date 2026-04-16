import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { VirtualPlayerProfile } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

const LOBBIES_REFRESH_DELAY_MS = 0;

@Injectable()
export class JoinFlowService {
    constructor(
        private readonly logger: Logger,
        private readonly lobbyService: LobbyService,
        private readonly gameLogicService: GameLogicService,
    ) {}

    emitAvailableLobbies(server: Server): void {
        server.emit(JoinGameEvents.UpdatedLobbiesList, this.lobbyService.getAvailableLobbies());
    }

    deferLobbiesRefresh(server: Server): void {
        setTimeout(() => this.emitAvailableLobbies(server), LOBBIES_REFRESH_DELAY_MS);
    }

    createLobby(server: Server, socket: Socket, payload: { game: Game; player: Player }): void {
        this.logger.log(`Payload (Lobby Created) by ${socket.id}`);
        this.lobbyService.initializeRealPlayer(payload.player, socket.id, true);
        const createdLobby = this.lobbyService.createLobby(payload.game, socket.id, payload.player);

        if (createdLobby) {
            socket.join(createdLobby.lobbyId);
            socket.emit(JoinGameEvents.GameHosted, createdLobby);
            this.emitAvailableLobbies(server);
        } else {
            socket.emit(JoinGameEvents.LobbyError, `Ce salon n'a pas pu être créé. (handleCreateLobby)`);
        }
    }

    joinLobby(server: Server, socket: Socket, payload: { lobbyId: string; player: Player }): void {
        const lobby = this.lobbyService.getLobby(payload.lobbyId);
        const lobbyError = this.lobbyService.getLobbyValidationError(lobby);
        if (lobbyError) {
            socket.emit(JoinGameEvents.LobbyError, lobbyError);
            return;
        }

        payload.player.character.name = this.lobbyService.getValidName(payload.player.character.name, lobby);
        this.lobbyService.initializeRealPlayer(payload.player, socket.id, false);

        let updatedLobby: Lobby;
        try {
            updatedLobby = this.lobbyService.joinLobby(payload.lobbyId, payload.player);
        } catch (error) {
            this.emitJoinError(socket, error, lobby);
            return;
        }

        if (updatedLobby) {
            socket.join(updatedLobby.lobbyId);
            socket.emit(JoinGameEvents.LobbyJoined, updatedLobby);
            socket.broadcast.to(updatedLobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);
            socket.broadcast.to(updatedLobby.lobbyId).emit(JoinGameEvents.PlayerJoined, payload.player);
            this.emitAvailableLobbies(server);
        }
    }

    getStatus(socket: Socket, lobbyId?: string): void {
        let lobby = this.lobbyService.findLobbyBySocketId(socket.id);
        if (!lobby && lobbyId) lobby = this.lobbyService.getLobby(lobbyId);

        if (lobby) {
            socket.join(lobby.lobbyId);
            socket.emit(JoinGameEvents.LobbyStatusReceived, lobby);
        } else {
            socket.emit(JoinGameEvents.LobbyError, 'Ce salon est introuvable.');
        }
    }

    selectAvatar(server: Server, socket: Socket, payload: { lobbyId: string; avatar: string }): void {
        const lobby = this.lobbyService.getLobby(payload.lobbyId);
        if (!lobby) return;

        this.lobbyService.updatePlayerAvatar(payload.lobbyId, socket.id, payload.avatar);
        const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
        server.to(payload.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
    }

    joinAvatarRoom(socket: Socket, lobbyId: string): void {
        const lobby = this.lobbyService.getLobby(lobbyId);
        if (lobby) {
            socket.join(lobbyId);
            const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
            socket.emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
        } else {
            this.logger.log(`Lobby not found for ${lobbyId} (handleJoinAvatarRoom)`);
        }
    }

    toggleLock(server: Server, socket: Socket, lobbyId: string): void {
        const updatedLobby = this.lobbyService.toggleLock(lobbyId, socket.id);
        if (updatedLobby) {
            server.to(lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);
            this.emitAvailableLobbies(server);
        }
    }

    kickPlayer(server: Server, socket: Socket, payload: { lobbyId: string; targetSocketId: string }): void {
        const success = this.lobbyService.kickPlayer(payload.lobbyId, socket.id, payload.targetSocketId);
        if (!success) return;

        server.to(payload.targetSocketId).emit(JoinGameEvents.PlayerKicked, `Vous avez été exclu par l'organisateur.`);
        server.in(payload.targetSocketId).socketsLeave(payload.lobbyId);

        const updatedLobby = this.lobbyService.getLobby(payload.lobbyId);
        server.to(payload.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);

        const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(updatedLobby);
        server.to(payload.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
        this.emitAvailableLobbies(server);
    }

    addVirtualPlayer(server: Server, socket: Socket, payload: { lobbyId: string; profile: VirtualPlayerProfile }): void {
        const lobby = this.lobbyService.getLobby(payload.lobbyId);
        const lobbyError = this.lobbyService.getLobbyValidationError(lobby);
        if (lobbyError) {
            socket.emit(JoinGameEvents.LobbyError, lobbyError);
            return;
        }

        const updatedLobby = this.lobbyService.addVirtualPlayerToLobby(payload.lobbyId, payload.profile);
        if (!updatedLobby) return;

        const virtualPlayer = updatedLobby.players[updatedLobby.players.length - 1];
        server.to(updatedLobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);
        server.to(updatedLobby.lobbyId).emit(JoinGameEvents.PlayerJoined, virtualPlayer);

        const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(updatedLobby);
        server.to(updatedLobby.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
        this.emitAvailableLobbies(server);
    }

    processPlayerLeave(server: Server, socket: Socket): void {
        const lobby = this.lobbyService.findLobbyBySocketId(socket.id);
        if (!lobby) return;
        if (this.gameLogicService.getActiveGame(lobby.lobbyId)) return;
        this.leaveFromWaitingLobby(server, socket, lobby);
    }

    private leaveFromWaitingLobby(server: Server, socket: Socket, lobby: Lobby): void {
        if (lobby.hostSocketId === socket.id) {
            this.logger.log(`Host left. Deleting lobby: ${lobby.lobbyId}`);
            socket.to(lobby.lobbyId).emit(JoinGameEvents.GameDeleted);
            this.lobbyService.deleteLobby(lobby.lobbyId);
            socket.leave(lobby.lobbyId);
        } else {
            const leavingPlayer = lobby.players.find((player) => player.socketId === socket.id);
            if (leavingPlayer) {
                this.logger.log(`${leavingPlayer.character.name} left lobby: ${lobby.lobbyId}`);
                this.lobbyService.removePlayerFromLobby(lobby.lobbyId, socket.id);
                socket.broadcast.to(lobby.lobbyId).emit(JoinGameEvents.PlayerLeft, leavingPlayer);
            } else {
                this.logger.log(`Pending player ${socket.id} left lobby: ${lobby.lobbyId}`);
                this.lobbyService.removePlayerFromLobby(lobby.lobbyId, socket.id);
            }
            socket.leave(lobby.lobbyId);

            const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
            server.to(lobby.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
            server.to(lobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, lobby);
        }
        this.emitAvailableLobbies(server);
    }

    private emitJoinError(socket: Socket, error: unknown, lobby: Lobby | undefined): void {
        const errorMessage = error instanceof Error && error.message === 'Avatar already taken'
            ? "Cet avatar n'est plus disponible. Veuillez en choisir un autre."
            : 'Impossible de rejoindre le salon.';
        socket.emit(JoinGameEvents.LobbyError, errorMessage);
        if (lobby) {
            const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
            socket.emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
        }
    }
}
