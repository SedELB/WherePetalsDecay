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
import { Lobby } from '@common/lobby';

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
            socket.emit(JoinGameEvents.LobbyError, `Ce salon n'a pas pu être créé. (handleCreateLobby)`);
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
            socket.emit(JoinGameEvents.LobbyError, `Ce salon n'existe plus.`);
            return;
        }

        if (lobby.playerCount >= lobby.game.maxPlayers){
            socket.emit(JoinGameEvents.LobbyError, 'Ce salon est plein !');
            return;
        }

        const finalPlayerName = this.getValidName(payload.player.character.name, lobby);

        payload.player.character.name = finalPlayerName;
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
        
        const allOccupiedAvatars = this.getOccupiedAvatars(lobby);
        this.server.to(gameId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
    }

    @SubscribeMessage(JoinGameEvents.JoinAvatarRoom)
    handleJoinAvatarRoom(@ConnectedSocket() socket: Socket, @MessageBody() gameId: string) {
        const lobby = this.lobbyService.getLobby(gameId);
        if (lobby) {
            socket.join(gameId);
            const allOccupiedAvatars = this.getOccupiedAvatars(lobby);
            socket.emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars);
        } else {
            this.logger.log(`>>> ERROR: LOBBY NOT FOUND FOR ${gameId}`);
        }
    }
    
    private getOccupiedAvatars(lobby: Lobby): string[] {
        const confirmedAvatars = lobby.players
            .map(player => player.character?.avatar)
            .filter(avat => avat !== undefined && avat !== null && avat !== '');

        const pendingAvatars = Object.values(lobby.pendingAvatars || {});
        return [...confirmedAvatars, ...pendingAvatars];
    }

    private getValidName(name: string, lobby: Lobby): string {
        let finalName = name;
        let counter = 2;
        while (lobby.players.some(player => player.character.name === finalName)){
            finalName = `${name}-${counter}`;
            counter++;
        }

        return finalName;
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
                
                const allOccupiedAvatars = this.getOccupiedAvatars(lobby);
                this.server.to(lobby.gameId).emit(JoinGameEvents.UpdateOccupiedAvatars, allOccupiedAvatars); // Release selected avatars for both pending and confirmed characters.
                // TODO UPDATE CURRENT PLAYERS THAT A PLAYER LEFT.
            }

            this.handleGetLobbies();
        }
    }
}
