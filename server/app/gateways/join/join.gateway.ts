import { Game } from '@common/game';
import { SocketNamespace } from '@common/enums';
import { Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
    OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';

import { LobbyService } from '@app/services/lobby/lobby.service';
import { Server, Socket } from 'socket.io';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Player } from '@common/player';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class JoinGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger, private readonly lobbyService: LobbyService) {}

    afterInit() {
        this.logger.log('JoinGateway initialized on join namespace');
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
    handleCreateLobby(
        @ConnectedSocket() socket: Socket,
        @MessageBody() payload: {game: Game, player: Player},
    ) {

        this.logger.log(`Payload (creation de lobby) reçu de ${socket.id}:`);
        payload.player.socketId = socket.id;
        payload.player.isHost = true;
        const createdLobby = this.lobbyService.createLobby(payload.game, socket.id, payload.player);

        if (createdLobby) {
            socket.join(createdLobby.gameId);
            socket.emit(JoinGameEvents.GameHosted, createdLobby);
            this.handleGetLobbies();
        } else {
            socket.emit(JoinGameEvents.LobbyError, 'The lobby could not be created.');
        }
    }

    @SubscribeMessage(JoinGameEvents.GetLobbies)
    handleGetLobbies() {
        const availableLobbies = this.lobbyService.getAvailableLobbies();
        this.server.emit(JoinGameEvents.UpdatedLobbiesList, availableLobbies);
    }


    @SubscribeMessage(JoinGameEvents.JoinLobby)
    handleJoinLobby(@ConnectedSocket() socket: Socket, @MessageBody() payload: {gameId: string, player: Player}) {
        const lobby = this.lobbyService.getLobby(payload.gameId);
        if (!lobby) {
            socket.emit(JoinGameEvents.LobbyError, 'This lobby does not exist anymore');
            return;
        }

        if (lobby.playerCount >= lobby.game.maxPlayers){
            socket.emit(JoinGameEvents.LobbyError, 'This lobby is full');
            return;
        }

        payload.player.socketId = socket.id;
        payload.player.isHost = false;
        const updatedLobby = this.lobbyService.joinLobby(payload.gameId, payload.player);
        if (updatedLobby) {
            socket.join(updatedLobby.gameId);
            socket.emit(JoinGameEvents.LobbyJoined, updatedLobby);
            this.server.to(updatedLobby.gameId).emit(JoinGameEvents.PlayerJoined, payload.player); // For the waiting room, to add new player's info
            this.handleGetLobbies();
        }
    }

    @SubscribeMessage(JoinGameEvents.GetLobbyStatus)
    handleGetStatus(@ConnectedSocket() socket: Socket) {
        const lobby = this.lobbyService.findLobbyBySocketId(socket.id);
        
        if (lobby) {
            socket.emit(JoinGameEvents.LobbyStatusReceived, {
                game: lobby.game,
            });
        } else {
            socket.emit(JoinGameEvents.LobbyError, 'Lobby not found');
        }
    }

    @SubscribeMessage(JoinGameEvents.SelectAvatar)
    handleSelectAvatar(
        @ConnectedSocket() socket: Socket, 
        @MessageBody() payload: { gameId: string, avatar: string },
    ) {
        const { gameId, avatar } = payload;
        const lobby = this.lobbyService.getLobby(gameId);
        
        if (!lobby) return;
        this.lobbyService.updatePlayerAvatar(gameId, socket.id, avatar);
        const confirmedAvatars = lobby.players
        .map(p => p.character?.avatar)
        .filter(a => !!a);

        const allOccupied = [...confirmedAvatars, ...Object.values(lobby.pendingAvatars)];
        this.server.to(gameId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupied);
    }

    @SubscribeMessage('joinAvatarRoom')
    handleJoinAvatarRoom(@ConnectedSocket() socket: Socket, @MessageBody() gameId: string) {
        const lobby = this.lobbyService.getLobby(gameId);
        if (lobby) {
            socket.join(gameId);

            const confirmedAvatars = lobby.players
            .map(p => p.character?.avatar)
            .filter(a => !!a);

            const pending = Object.values(lobby.pendingAvatars);
            const allOccupied = [...confirmedAvatars, ...pending];
            socket.emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupied);
        } else {
            this.logger.log(`>>> ERROR: LOBBY NOT FOUND FOR ${gameId}`);
        }
    }
    

    private processPlayerLeave(socket: Socket){
        const lobby = this.lobbyService.findLobbyBySocketId(socket.id);

        if (lobby) {
            if (lobby.hostSocketId === socket.id){
                this.logger.log(`Host left. Deleting lobby: ${lobby.gameId}`);
                this.server.to(lobby.gameId).emit(JoinGameEvents.GameDeleted); // Warn lobby members that host was disconnected.
                this.lobbyService.deleteLobby(lobby.gameId);
            } else {
                this.logger.log(`Player left lobby: ${lobby.gameId}`);
                this.lobbyService.removePlayerFromLobby(lobby.gameId, socket.id);
                this.handleJoinAvatarRoom(socket, lobby.gameId);
                // TODO UPDATE CURRENT PLAYERS THAT A PLAYER LEFT.
            }

            this.handleGetLobbies();
        }
    }
}
