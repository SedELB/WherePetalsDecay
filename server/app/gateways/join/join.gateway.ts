import { Game } from '@common/game';
import { SocketNamespace } from '@common/enums';
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

import { LobbyService } from '@app/services/lobby/lobby.service';
import { Server, Socket } from 'socket.io';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Player } from '@common/player';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { Lobby } from '@common/lobby';

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

    @SubscribeMessage(JoinGameEvents.JoinLobby)
    handleJoinLobby(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; player: Player }) {
        const lobby = this.lobbyService.getLobby(payload.lobbyId);
        if (!lobby) {
            socket.emit(JoinGameEvents.LobbyError, `Ce salon n'existe plus.`);
            return;
        }

        if (lobby.playerCount >= lobby.game.maxPlayers) {
            socket.emit(JoinGameEvents.LobbyError, 'Ce salon est plein !');
            return;
        }

        const finalPlayerName = this.getValidName(payload.player.character.name, lobby);

        payload.player.character.name = finalPlayerName;
        payload.player.socketId = socket.id;
        payload.player.isHost = false;

        const updatedLobby = this.lobbyService.joinLobby(payload.lobbyId, payload.player);

        if (updatedLobby) {
            socket.join(updatedLobby.lobbyId);
            socket.emit(JoinGameEvents.LobbyJoined, updatedLobby);
            this.server.to(updatedLobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, updatedLobby); // For the waiting room, to add new player's info
            this.handleGetLobbies();
        }
    }

    @SubscribeMessage(JoinGameEvents.GetLobbyStatus)
    handleGetStatus(@ConnectedSocket() socket: Socket) {
        const lobby = this.lobbyService.findLobbyBySocketId(socket.id);

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

        const allOccupiedAvatars = this.getOccupiedAvatars(lobby);
        this.server.to(lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
    }

    @SubscribeMessage(JoinGameEvents.JoinAvatarRoom)
    handleJoinAvatarRoom(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const lobby = this.lobbyService.getLobby(lobbyId);
        if (lobby) {
            socket.join(lobbyId);
            const allOccupiedAvatars = this.getOccupiedAvatars(lobby);
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

            const allOccupiedAvatars = this.getOccupiedAvatars(updatedLobby);
            this.server.to(payload.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
            this.handleGetLobbies();
        }
    }

    private getOccupiedAvatars(lobby: Lobby): string[] {
        const confirmedAvatars = lobby.players
            .map((player) => player.character?.avatar)
            .filter((avat) => avat !== undefined && avat !== null && avat !== '');

        const pendingAvatars = Object.values(lobby.pendingAvatars || {});
        return [...confirmedAvatars, ...pendingAvatars];
    }

    private getValidName(name: string, lobby: Lobby): string {
        let finalName = name;
        let counter = 2;
        while (lobby.players.some((player) => player.character.name === finalName)) {
            finalName = `${name}-${counter}`;
            counter++;
        }

        return finalName;
    }

    private processPlayerLeave(socket: Socket) {
        const lobby = this.lobbyService.findLobbyBySocketId(socket.id);

        if (lobby) {
            if (lobby.hostSocketId === socket.id) {
                this.logger.log(`Host left. Deleting lobby: ${lobby.lobbyId}`);
                socket.to(lobby.lobbyId).emit(JoinGameEvents.GameDeleted); // Warn lobby members that host was disconnected.
                this.lobbyService.deleteLobby(lobby.lobbyId);
            } else {
                this.logger.log(`Player left lobby: ${lobby.lobbyId}`);
                this.lobbyService.removePlayerFromLobby(lobby.lobbyId, socket.id);

                const allOccupiedAvatars = this.getOccupiedAvatars(lobby);
                this.server.to(lobby.lobbyId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars); // Release selected avatars for both pending and confirmed characters.
                this.server.to(lobby.lobbyId).emit(JoinGameEvents.LobbyUpdated, lobby);
            }

            this.handleGetLobbies();
        }
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const finalLobby = this.lobbyService.canStartGame(lobbyId, socket.id);
        if (finalLobby) {
            finalLobby.players = this.gameLogicService.shufflePlayers(finalLobby.players);
            this.server.to(lobbyId).emit(JoinGameEvents.GameStarting, finalLobby);
        } else {
            socket.emit(JoinGameEvents.LobbyError, `Impossible de demarrer la partie. (Minimum 2 joueurs requis.)`);
        }
    }

    @SubscribeMessage(JoinGameEvents.PlayerAbandon)
    handlePlayerAbandon(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string) {
        const updatedLobby = this.lobbyService.abandonPlayer(lobbyId, socket.id);
        if (updatedLobby) {
            this.server.to(lobbyId).emit(JoinGameEvents.GameLobbyUpdated, updatedLobby);
        }
        socket.emit(JoinGameEvents.LeftLobby);
    }
}
