import { RoomCreatePayload, RoomJoinPayload } from '@common/room';
import { SocketNamespace } from '@common/enums';
import { WaitingRoomEvents } from '@common/waiting-room-events';
import { Logger } from '@nestjs/common';
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
import { Server, Socket } from 'socket.io';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';

@WebSocketGateway({ namespace: SocketNamespace.WaitingRoom, cors: true })
export class WaitingRoomGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        private readonly waitingRoomService: WaitingRoomService,
    ) {}

    afterInit() {
        this.logger.log('WaitingRoomGateway initialized on /waiting-room namespace');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connected to waiting-room: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Client disconnected from waiting-room: ${socket.id}`);
        this.handlePlayerLeave(socket);
    }

    @SubscribeMessage(WaitingRoomEvents.CreateRoom)
    handleCreateRoom(@ConnectedSocket() socket: Socket, @MessageBody() payload: RoomCreatePayload): void {
        const room = this.waitingRoomService.createRoom(socket.id, payload);
        socket.join(room.code);
        socket.emit(WaitingRoomEvents.RoomCreated, room);
        this.logger.log(`Room ${room.code} created by ${socket.id}`);
    }

    @SubscribeMessage(WaitingRoomEvents.JoinRoom)
    handleJoinRoom(@ConnectedSocket() socket: Socket, @MessageBody() payload: RoomJoinPayload): void {
        const room = this.waitingRoomService.getRoom(payload.roomCode);

        if (!room) {
            socket.emit(WaitingRoomEvents.Error, { message: "Cette salle n'existe pas." });
            return;
        }

        if (room.isLocked) {
            socket.emit(WaitingRoomEvents.Error, { message: 'Cette salle est verrouillée.' });
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit(WaitingRoomEvents.Error, { message: 'Cette salle est pleine.' });
            return;
        }

        // Ajuster le nom si déjà pris
        const uniqueName = this.waitingRoomService.getUniquePlayerName(payload.roomCode, payload.player.character.name);
        const character = { ...payload.player.character, name: uniqueName };

        const updatedRoom = this.waitingRoomService.addPlayer(payload.roomCode, socket.id, character);

        if (!updatedRoom) {
            socket.emit(WaitingRoomEvents.Error, { message: 'Impossible de rejoindre la salle.' });
            return;
        }

        socket.join(payload.roomCode);

        const newPlayer = updatedRoom.players.find((p) => p.socketId === socket.id);
        socket.emit(WaitingRoomEvents.RoomJoined, updatedRoom);
        socket.to(payload.roomCode).emit(WaitingRoomEvents.PlayerJoined, newPlayer);

        if (updatedRoom.isLocked) {
            this.server.to(payload.roomCode).emit(WaitingRoomEvents.RoomLocked);
        }

        this.logger.log(`Player ${socket.id} joined room ${payload.roomCode}`);
    }

    @SubscribeMessage(WaitingRoomEvents.LeaveRoom)
    handleLeaveRoom(@ConnectedSocket() socket: Socket): void {
        this.handlePlayerLeave(socket);
    }

    @SubscribeMessage(WaitingRoomEvents.KickPlayer)
    handleKickPlayer(@ConnectedSocket() socket: Socket, @MessageBody() targetPlayerId: string): void {
        const result = this.waitingRoomService.kickPlayer(socket.id, targetPlayerId);

        if (!result) {
            socket.emit(WaitingRoomEvents.Error, { message: "Impossible d'exclure ce joueur." });
            return;
        }

        const { room, kickedPlayer } = result;

        this.server.to(targetPlayerId).emit(WaitingRoomEvents.PlayerKicked, {
            message: "Vous avez été exclu de la salle d'attente par l'organisateur.",
        });

        this.server.in(targetPlayerId).socketsLeave(room.code);

        socket.to(room.code).emit(WaitingRoomEvents.PlayerLeft, kickedPlayer);
        this.server.to(room.code).emit(WaitingRoomEvents.RoomUpdated, room);

        if (!room.isLocked) {
            this.server.to(room.code).emit(WaitingRoomEvents.RoomUnlocked);
        }

        this.logger.log(`Player ${targetPlayerId} kicked from room ${room.code}`);
    }

    @SubscribeMessage(WaitingRoomEvents.StartGame)
    handleStartGame(@ConnectedSocket() socket: Socket): void {
        const room = this.waitingRoomService.getRoomByPlayerId(socket.id);

        if (!room) {
            socket.emit(WaitingRoomEvents.Error, { message: 'Salle introuvable.' });
            return;
        }

        if (!this.waitingRoomService.canStartGame(room.code, socket.id)) {
            socket.emit(WaitingRoomEvents.Error, {
                message: "Impossible de démarrer : il faut au moins 2 joueurs et être l'organisateur.",
            });
            return;
        }

        this.server.to(room.code).emit(WaitingRoomEvents.GameStarting, {
            gameId: room.gameId,
            players: room.players,
        });

        this.logger.log(`Game starting in room ${room.code}`);
    }

    @SubscribeMessage(WaitingRoomEvents.ToggleLock)
    handleToggleLock(@ConnectedSocket() socket: Socket): void {
        const room = this.waitingRoomService.getRoomByPlayerId(socket.id);

        if (!room) {
            socket.emit(WaitingRoomEvents.Error, { message: 'Salle introuvable.' });
            return;
        }

        const updatedRoom = this.waitingRoomService.toggleLock(room.code, socket.id);

        if (!updatedRoom) {
            socket.emit(WaitingRoomEvents.Error, { message: 'Impossible de modifier le verrouillage.' });
            return;
        }

        const event = updatedRoom.isLocked ? WaitingRoomEvents.RoomLocked : WaitingRoomEvents.RoomUnlocked;
        this.server.to(room.code).emit(event);
        this.server.to(room.code).emit(WaitingRoomEvents.RoomUpdated, updatedRoom);
    }

    private handlePlayerLeave(socket: Socket): void {
        const result = this.waitingRoomService.removePlayer(socket.id);

        if (!result) return;

        const { room, removedPlayer, wasOrganizer } = result;

        socket.leave(room.code);

        if (wasOrganizer) {
            this.waitingRoomService.deleteRoom(room.code);
            this.server.to(room.code).emit(WaitingRoomEvents.RoomClosed, {
                message: "L'organisateur a quitté la salle. La partie est annulée.",
            });

            this.server.in(room.code).socketsLeave(room.code);

            this.logger.log(`Room ${room.code} closed (organizer left)`);
        } else {
            socket.to(room.code).emit(WaitingRoomEvents.PlayerLeft, removedPlayer);
            this.server.to(room.code).emit(WaitingRoomEvents.RoomUpdated, room);

            if (!room.isLocked) {
                this.server.to(room.code).emit(WaitingRoomEvents.RoomUnlocked);
            }

            this.logger.log(`Player ${socket.id} left room ${room.code}`);
        }
    }
}
