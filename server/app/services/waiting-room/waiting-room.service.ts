import { Player } from '@common/player';
import { Room, RoomCreatePayload } from '@common/room';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WaitingRoomService {
    private rooms: Map<string, Room> = new Map();
    private playerToRoom: Map<string, string> = new Map(); // socketId -> roomCode

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
            id: socketId,
            name: payload.player.name,
            avatar: payload.player.avatar,
            isOrganizer: true,
            life: payload.player.life,
            speed: payload.player.speed,
            attack: payload.player.attack,
            defense: payload.player.defense,
            attackDice: payload.player.attackDice,
            defenseDice: payload.player.defenseDice,
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

    addPlayer(code: string, socketId: string, playerData: Omit<Player, 'id' | 'isOrganizer'>): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;
        if (room.isLocked) return null;
        if (room.players.length >= room.maxPlayers) return null;

        const player: Player = {
            id: socketId,
            ...playerData,
            isOrganizer: false,
        };

        room.players.push(player);
        this.playerToRoom.set(socketId, code);

        // Auto-lock si max atteint
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

        const playerIndex = room.players.findIndex((p) => p.id === socketId);
        if (playerIndex === -1) return null;

        const removedPlayer = room.players.splice(playerIndex, 1)[0];
        this.playerToRoom.delete(socketId);

        const wasOrganizer = removedPlayer.isOrganizer;

        // Auto-unlock si sous le max
        if (room.players.length < room.maxPlayers) {
            room.isLocked = false;
        }

        return { room, removedPlayer, wasOrganizer };
    }

    kickPlayer(organizerId: string, targetPlayerId: string): { room: Room; kickedPlayer: Player } | null {
        const room = this.getRoomByPlayerId(organizerId);
        if (!room) return null;
        if (room.organizerId !== organizerId) return null; // Seul l'organisateur peut kick

        const targetIndex = room.players.findIndex((p) => p.id === targetPlayerId);
        if (targetIndex === -1) return null;
        if (room.players[targetIndex].isOrganizer) return null; // Ne peut pas se kick soi-même

        const kickedPlayer = room.players.splice(targetIndex, 1)[0];
        this.playerToRoom.delete(targetPlayerId);

        // Auto-unlock si sous le max
        if (room.players.length < room.maxPlayers) {
            room.isLocked = false;
        }

        return { room, kickedPlayer };
    }

    deleteRoom(code: string): Player[] {
        const room = this.rooms.get(code);
        if (!room) return [];

        const players = [...room.players];
        players.forEach((p) => this.playerToRoom.delete(p.id));
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

        // Ne peut pas unlock si déjà au max
        if (room.isLocked && room.players.length >= room.maxPlayers) {
            return room; // Reste locked
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
        return room.players.map((p) => p.avatar);
    }

    isNameTaken(code: string, name: string): boolean {
        const room = this.rooms.get(code);
        if (!room) return false;
        return room.players.some((p) => p.name.toLowerCase() === name.toLowerCase());
    }

    getUniquePlayerName(code: string, baseName: string): string {
        const room = this.rooms.get(code);
        if (!room) return baseName;

        let name = baseName;
        let suffix = 2;

        while (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
            name = `${baseName}-${suffix}`;
            suffix++;
        }

        return name;
    }
}
