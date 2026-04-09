import { PlayerType, SocketNamespace, VirtualPlayerProfile } from '@common/enums';
import { Game } from '@common/game';
import { Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';

import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Server, Socket } from 'socket.io';

const INITIAL_WINS_COUNT = 0;
const LOBBIES_REFRESH_DELAY_MS = 0;

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class JoinGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly lobbyService: LobbyService,
        private readonly gameLogicService: GameLogicService,
    ) {}

    afterInit() {
        this.logger.log('JoinGateway initialized on /join namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Player client connected: ${socket.id}`);
    }

    // Automatic disconnect
    handleDisconnect(socket: Socket) {
        this.processPlayerLeave(socket);
    }

    // Manual disconnect (leave button)
    @SubscribeMessage(JoinGameEvents.LeaveLobby)
    handleLeaveLobby(@ConnectedSocket() socket: Socket) {
        this.processPlayerLeave(socket);
    }

    @SubscribeMessage(JoinGameEvents.CreateLobby)
    handleCreateLobby(@ConnectedSocket() socket: Socket, @MessageBody() payload: { game: Game; player: Player }) {
        this.logger.log(`Payload (Lobby Created) by ${socket.id}`);
        payload.player.socketId = socket.id;
        payload.player.isHost = true;
        payload.player.winsCount = INITIAL_WINS_COUNT;
        payload.player.hasAbandonned = false;
        payload.player.playerType = PlayerType.Reel;
        payload.player.combatCount = 0;
        payload.player.lossCount = 0;
        payload.player.totalHpLost = 0;
        payload.player.totalHpDealt = 0;
        payload.player.visitedTilesCount = 0;
        const createdLobby = this.lobbyService.createLobby(payload.game, socket.id, payload.player);

        if (createdLobby) {
            socket.join(createdLobby.lobbyId);
            socket.emit(JoinGameEvents.GameHosted, createdLobby);
            this.handleGetLobbies();
        } else {
            socket.emit(JoinGameEvents.LobbyError, `Ce salon n'a pas pu être créé. (handleCreateLobby)`);
        }
    }

    @SubscribeMessage(JoinGameEvents.GetLobbies)
    handleGetLobbies() {
        const availableLobbies = this.lobbyService.getAvailableLobbies();
        this.server.emit(JoinGameEvents.UpdatedLobbiesList, availableLobbies);
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGameLobbiesRefresh() {
        this.deferLobbiesRefresh();
    }

    @SubscribeMessage(JoinGameEvents.LeaveEndGame)
    handleLeaveEndGameLobbiesRefresh() {
        this.deferLobbiesRefresh();
    }

    @SubscribeMessage(JoinGameEvents.JoinLobby)
    handleJoinLobby(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; player: Player }) {
        const lobby = this.lobbyService.getLobby(payload.lobbyId);
        const lobbyError = this.lobbyService.getLobbyValidationError(lobby);
        if (lobbyError) {
            socket.emit(JoinGameEvents.LobbyError, lobbyError);
            return;
        }

        const finalPlayerName = this.lobbyService.getValidName(payload.player.character.name, lobby);

        payload.player.character.name = finalPlayerName;
        payload.player.socketId = socket.id;
        payload.player.isHost = false;
        payload.player.winsCount = INITIAL_WINS_COUNT;
        payload.player.combatCount = 0;
        payload.player.lossCount = 0;
        payload.player.totalHpLost = 0;
        payload.player.totalHpDealt = 0;
        payload.player.visitedTilesCount = 0;
        payload.player.hasAbandonned = false;
        payload.player.playerType = PlayerType.Reel;

        let updatedLobby: Lobby;
        try {
            updatedLobby = this.lobbyService.joinLobby(payload.lobbyId, payload.player);
        } catch (error) {
            const errorMessage = error instanceof Error && error.message === 'Avatar already taken'
                ? "Cet avatar n'est plus disponible. Veuillez en choisir un autre."
                : 'Impossible de rejoindre le salon.';
            socket.emit(JoinGameEvents.LobbyError, errorMessage);

            if (lobby) {
                const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
                socket.emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
            }
            return;
        }

        if (updatedLobby) {
            socket.join(updatedLobby.lobbyId);
            socket.emit(JoinGameEvents.LobbyJoined, updatedLobby);
            socket.broadcast.to(updatedLobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);
            socket.broadcast.to(updatedLobby.lobbyId).emit(JoinGameEvents.PlayerJoined, payload.player);
            this.handleGetLobbies();
        }
    }

    @SubscribeMessage(JoinGameEvents.GetLobbyStatus)
    handleGetStatus(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId?: string) {
        let lobby = this.lobbyService.findLobbyBySocketId(socket.id);

        if (!lobby && lobbyId) {
            lobby = this.lobbyService.getLobby(lobbyId);
        }

        if (lobby) {
            socket.join(lobby.lobbyId);
            socket.emit(JoinGameEvents.LobbyStatusReceived, lobby);
        } else {
            socket.emit(JoinGameEvents.LobbyError, 'Ce salon est introuvable.');
        }
    }

    @SubscribeMessage(JoinGameEvents.SelectAvatar)
    handleSelectAvatar(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; avatar: string }) {
        const { lobbyId, avatar } = payload;
        const lobby = this.lobbyService.getLobby(lobbyId);

        if (!lobby) return;
        this.lobbyService.updatePlayerAvatar(lobbyId, socket.id, avatar);

        const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
        this.server.to(lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
    }

    @SubscribeMessage(JoinGameEvents.JoinAvatarRoom)
    handleJoinAvatarRoom(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const lobby = this.lobbyService.getLobby(lobbyId);
        if (lobby) {
            socket.join(lobbyId);
            const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(lobby);
            socket.emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
        } else {
            this.logger.log(`Lobby not found for ${lobbyId} (handleJoinAvatarRoom)`);
        }
    }

    @SubscribeMessage(JoinGameEvents.ToggleLock)
    handleToggleLock(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const updatedLobby = this.lobbyService.toggleLock(lobbyId, socket.id);
        if (updatedLobby) {
            this.server.to(lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);
            this.handleGetLobbies();
        }
    }

    @SubscribeMessage(JoinGameEvents.KickPlayer)
    handleKickPlayer(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }) {
        const success = this.lobbyService.kickPlayer(payload.lobbyId, socket.id, payload.targetSocketId);

        if (success) {

            this.server.to(payload.targetSocketId).emit(JoinGameEvents.PlayerKicked, `Vous avez été exclu par l'organisateur.`);
            this.server.in(payload.targetSocketId).socketsLeave(payload.lobbyId);

            const updatedLobby = this.lobbyService.getLobby(payload.lobbyId);
            this.server.to(payload.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);

            const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(updatedLobby);
            this.server.to(payload.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
            this.handleGetLobbies();
        }
    }

    @SubscribeMessage(JoinGameEvents.AddVirtualPlayer)
    handleAddVirtualPlayer(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; profile: VirtualPlayerProfile }) {
        const lobby = this.lobbyService.getLobby(payload.lobbyId);
        const lobbyError = this.lobbyService.getLobbyValidationError(lobby);
        if (lobbyError) {
            socket.emit(JoinGameEvents.LobbyError, lobbyError);
            return;
        }

        const updatedLobby = this.lobbyService.addVirtualPlayerToLobby(payload.lobbyId, payload.profile);

        if (updatedLobby) {
            const virtualPlayer = updatedLobby.players[updatedLobby.players.length - 1];

            this.server.to(updatedLobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby);
            this.server.to(updatedLobby.lobbyId).emit(JoinGameEvents.PlayerJoined, virtualPlayer);

            const allOccupiedAvatars = this.lobbyService.getOccupiedAvatars(updatedLobby);
            this.server.to(updatedLobby.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);

            this.handleGetLobbies();
        }
    }

    private leaveFromWaitingLobby(lobby: Lobby, socket: Socket) {
        if (lobby.hostSocketId === socket.id) {
            this.logger.log(`Host left. Deleting lobby: ${lobby.lobbyId}`);
            socket.to(lobby.lobbyId).emit(JoinGameEvents.GameDeleted);
            this.lobbyService.deleteLobby(lobby.lobbyId);
            socket.leave(lobby.lobbyId);
        } else {
            const leavingPlayer = lobby.players.find(player => player.socketId === socket.id);

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
            this.server.to(lobby.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
            this.server.to(lobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, lobby);
        }

        this.handleGetLobbies();
    }

    private processPlayerLeave(socket: Socket) {
        const lobby = this.lobbyService.findLobbyBySocketId(socket.id);
        if (!lobby) return;

        const isGameActive = this.gameLogicService.getActiveGame(lobby.lobbyId);
        if (isGameActive) return;

        this.leaveFromWaitingLobby(lobby, socket);
    }

    private deferLobbiesRefresh() {
        setTimeout(() => this.handleGetLobbies(), LOBBIES_REFRESH_DELAY_MS);
    }
}
