import { Character } from '@common/character';
import { Player } from '@common/player';
import { Room, RoomCreatePayload } from '@common/room';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WaitingRoomService {
    private rooms: Map<string, Room> = new Map();
    private playerToRoom: Map<string, string> = new Map();

    generateRoomCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code: string;
        do {
            code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        } while (this.rooms.has(code));
        return code;
    }

    createRoom(socketId: string, payload: RoomCreatePayload): Room {
        const code = this.generateRoomCode();
        const organizer: Player = {
            socketId,
            character: payload.player.character,
            isHost: true,
        };

        const room: Room = {
            code,
            gameId: payload.gameId,
            gameName: payload.gameName,
            maxPlayers: payload.maxPlayers,
            players: [organizer],
            isLocked: false,
            organizerId: socketId,
        };

        this.rooms.set(code, room);
        this.playerToRoom.set(socketId, code);
        return room;
    }

    getRoom(code: string): Room | undefined {
        return this.rooms.get(code);
    }

    getRoomByPlayerId(socketId: string): Room | undefined {
        const code = this.playerToRoom.get(socketId);
        return code ? this.rooms.get(code) : undefined;
    }

    addPlayer(code: string, socketId: string, character: Character): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;
        if (room.isLocked) return null;
        if (room.players.length >= room.maxPlayers) return null;

        const player: Player = {
            socketId,
            character,
            isHost: false,
        };

        room.players.push(player);
        this.playerToRoom.set(socketId, code);

        if (room.players.length >= room.maxPlayers) {
            room.isLocked = true;
        }

        return room;
    }

    removePlayer(socketId: string): { room: Room; removedPlayer: Player; wasOrganizer: boolean } | null {
        const code = this.playerToRoom.get(socketId);
        if (!code) return null;

        const room = this.rooms.get(code);
        if (!room) return null;

        const playerIndex = room.players.findIndex((p) => p.socketId === socketId);
        if (playerIndex === -1) return null;

        const removedPlayer = room.players.splice(playerIndex, 1)[0];
        this.playerToRoom.delete(socketId);

        const wasOrganizer = removedPlayer.isHost;

        if (room.players.length < room.maxPlayers) {
            room.isLocked = false;
        }

        return { room, removedPlayer, wasOrganizer };
    }

    kickPlayer(organizerId: string, targetPlayerId: string): { room: Room; kickedPlayer: Player } | null {
        const room = this.getRoomByPlayerId(organizerId);
        if (!room) return null;
        if (room.organizerId !== organizerId) return null;

        const targetIndex = room.players.findIndex((p) => p.socketId === targetPlayerId);
        if (targetIndex === -1) return null;
        if (room.players[targetIndex].isHost) return null;

        const kickedPlayer = room.players.splice(targetIndex, 1)[0];
        this.playerToRoom.delete(targetPlayerId);

        if (room.players.length < room.maxPlayers) {
            room.isLocked = false;
        }

        return { room, kickedPlayer };
    }

    deleteRoom(code: string): Player[] {
        const room = this.rooms.get(code);
        if (!room) return [];

        const players = [...room.players];
        players.forEach((p) => this.playerToRoom.delete(p.socketId));
        this.rooms.delete(code);

        return players;
    }

    canStartGame(code: string, organizerId: string): boolean {
        const room = this.rooms.get(code);
        if (!room) return false;
        if (room.organizerId !== organizerId) return false;
        return room.players.length >= 2;
    }

    toggleLock(code: string, organizerId: string): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;
        if (room.organizerId !== organizerId) return null;

        if (room.isLocked && room.players.length >= room.maxPlayers) {
            return room;
        }

        room.isLocked = !room.isLocked;
        return room;
    }

    getAvailableRooms(): Room[] {
        return Array.from(this.rooms.values()).filter((room) => !room.isLocked && room.players.length < room.maxPlayers);
    }

    getUsedAvatars(code: string): string[] {
        const room = this.rooms.get(code);
        if (!room) return [];
        return room.players.map((p) => p.character.avatar);
    }

    isNameTaken(code: string, name: string): boolean {
        const room = this.rooms.get(code);
        if (!room) return false;
        return room.players.some((p) => p.character.name.toLowerCase() === name.toLowerCase());
    }

    getUniquePlayerName(code: string, baseName: string): string {
        const room = this.rooms.get(code);
        if (!room) return baseName;

        let name = baseName;
        let suffix = 2;

        while (room.players.some((p) => p.character.name.toLowerCase() === name.toLowerCase())) {
            name = `${baseName}-${suffix}`;
            suffix++;
        }

        return name;
    }
}
