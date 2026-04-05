/**
 * Testing:
 * - Lobby lifecycle: creation, retrieval, deletion
 * - Player management: joining, leaving, counting
 * - State transitions: locking/unlocking based on playerCount vs maxPlayers
 * - Avatar management: pending and confirmed player avatars
 * - Edge cases: empty lobbies, full lobbies, missing lobbies, duplicate socket removals
 */

import { GameMode } from '@common/enums';
import { Game } from '@common/game';
import { Player } from '@common/player';
import { Test, TestingModule } from '@nestjs/testing';
import { LobbyService } from './lobby.service';

describe('LobbyService', () => {
    let service: LobbyService;

    const mockGame: Game = {
        _id: '1',
        name: 'Test Game',
        description: 'Test Description',
        size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic,
        thumbnail: 'test.png',
        maxPlayers: 4,
        grid: [],
        isVisible: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
    };

    const mockPlayer: Player = {
        socketId: '',
        character: {
            name: 'MOCK_PLAYER',
            avatar: 'mockavatar.png',
            life: 0,
            speed: 0,
            attack: 0,
            defense: 0,
            lifeBonus: false,
            attackDice: 'D4',
            defenseDice: 'D6',
        },
        isHost: false,
        winsCount: 0,
        flagsCaptured: 0,
        hasAbandonned: false,
        hasFlag: false,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [LobbyService],
        }).compile();

        service = module.get<LobbyService>(LobbyService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createLobby', () => {
        it('should create and store a lobby', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            expect(lobby.gameId).toBe('1');
            expect(lobby.hostSocketId).toBe('socket-1');
            expect(lobby.playerCount).toBe(1);
            expect(lobby.isLocked).toBe(false);
            expect(lobby.players[0].socketId).toBe('socket-1');
        });

        it('should make the lobby retrievable after creation', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            expect(service.getLobby(lobby.lobbyId)).toBeDefined();
        });
    });

    describe('getLobby', () => {
        it('should return the lobby if it exists', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            expect(service.getLobby(lobby.lobbyId)?.gameId).toBe('1');
        });

        it('should return undefined if lobby does not exist', () => {
            expect(service.getLobby('nonexistent')).toBeUndefined();
        });
    });

    describe('getAvailableLobbies', () => {
        it('should return lobbies that are not locked and not full', () => {
            service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            expect(service.getAvailableLobbies()).toHaveLength(1);
        });

        it('should not return locked lobbies', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            const retrievedLobby = service.getLobby(lobby.lobbyId);
            retrievedLobby.isLocked = true;

            expect(service.getAvailableLobbies()).toHaveLength(0);
        });
        // EDGE CASE: A lobby with maxPlayers=1 becomes unavailable after 1 player joins
        // This ensures that completely full lobbies don't appear in the available list
        it('should not return full lobbies', () => {
            const smallGame = { ...mockGame, _id: '2', maxPlayers: 1 };
            service.createLobby(smallGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            expect(service.getAvailableLobbies()).toHaveLength(0);
        });
    });

    describe('joinLobby', () => {
        it('should add a player and update playerCount', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            const updatedLobby = service.joinLobby(lobby.lobbyId, { ...mockPlayer, socketId: 'socket-2' });

            expect(updatedLobby.players).toHaveLength(2);
            expect(updatedLobby.playerCount).toBe(2);
        });

        // EDGE CASE: Lobby automatically locks when playerCount reaches maxPlayers
        // This prevents race conditions where multiple players join simultaneously
        it('should lock the lobby when it reaches maxPlayers', () => {
            const smallGame = { ...mockGame, _id: '2', maxPlayers: 2 };
            const lobby = service.createLobby(smallGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            const updatedLobby = service.joinLobby(lobby.lobbyId, { ...mockPlayer, socketId: 'socket-2' });

            expect(updatedLobby.isLocked).toBe(true);
        });

        it('should throw if lobby does not exist', () => {
            expect(() => service.joinLobby('nonexistent', { ...mockPlayer, socketId: 'socket-1' })).toThrow();
        });

        // EDGE CASE: Attempting to join a locked lobby fails with error
        // This prevents players from circumventing the maxPlayers limit
        it('should throw if lobby is locked', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            const retrievedLobby = service.getLobby(lobby.lobbyId);
            retrievedLobby.isLocked = true;

            expect(() => service.joinLobby(lobby.lobbyId, { ...mockPlayer, socketId: 'socket-2' })).toThrow();
        });
    });

    describe('deleteLobby', () => {
        it('should remove the lobby', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            service.deleteLobby(lobby.lobbyId);

            expect(service.getLobby(lobby.lobbyId)).toBeUndefined();
        });
    });

    describe('findLobbyBySocketId', () => {
        it('should find lobby by hostSocketId', () => {
            service.createLobby(mockGame, 'socket-host', { ...mockPlayer, socketId: 'socket-host' });

            expect(service.findLobbyBySocketId('socket-host')).toBeDefined();
        });

        it('should find lobby by player socketId', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            service.joinLobby(lobby.lobbyId, { ...mockPlayer, socketId: 'socket-2' });

            expect(service.findLobbyBySocketId('socket-2')).toBeDefined();
        });

        it('should find lobby by pendingAvatars key', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            const retrievedLobby = service.getLobby(lobby.lobbyId);
            retrievedLobby.pendingAvatars['socket-pending'] = 'avatar.png';

            expect(service.findLobbyBySocketId('socket-pending')).toBeDefined();
        });

        it('should return undefined if socketId is not in any lobby', () => {
            expect(service.findLobbyBySocketId('unknown')).toBeUndefined();
        });
    });

    describe('removePlayerFromLobby', () => {
        it('should remove the player and update playerCount', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            service.joinLobby(lobby.lobbyId, { ...mockPlayer, socketId: 'socket-2' });

            service.removePlayerFromLobby(lobby.lobbyId, 'socket-2');

            const updatedLobby = service.getLobby(lobby.lobbyId);
            expect(updatedLobby.players).toHaveLength(1);
            expect(updatedLobby.playerCount).toBe(1);
        });

        // EDGE CASE: Lobby automatically unlocks when a player leaves and playerCount drops below maxPlayers
        // This allows new players to join again after someone disconnects
        it('should unlock lobby when playerCount drops below maxPlayers', () => {
            const smallGame = { ...mockGame, _id: '2', maxPlayers: 2 };
            const lobby = service.createLobby(smallGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            service.joinLobby(lobby.lobbyId, { ...mockPlayer, socketId: 'socket-2' });

            service.removePlayerFromLobby(lobby.lobbyId, 'socket-2');

            const updatedLobby = service.getLobby(lobby.lobbyId);
            expect(updatedLobby.isLocked).toBe(false);
        });

        it('should remove player from pendingAvatars on leave', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            const retrievedLobby = service.getLobby(lobby.lobbyId);
            retrievedLobby.pendingAvatars['socket-2'] = 'avatar.png';

            service.removePlayerFromLobby(lobby.lobbyId, 'socket-2');

            expect(retrievedLobby.pendingAvatars['socket-2']).toBeUndefined();
        });

        // EDGE CASE: Removing a non-existent lobby doesn't throw error
        // This prevents crashes when cleaning up players from already-deleted lobbies
        it('should do nothing if lobby does not exist', () => {
            expect(() => service.removePlayerFromLobby('nonexistent', 'socket-1')).not.toThrow();
        });
    });

    describe('updatePlayerAvatar', () => {
        it('should update avatar of a confirmed player', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            service.updatePlayerAvatar(lobby.lobbyId, 'socket-1', 'new-avatar.png');

            const updatedLobby = service.getLobby(lobby.lobbyId);
            expect(updatedLobby.players[0].character.avatar).toBe('new-avatar.png');
        });

        // EDGE CASE: Avatar update for a pending socket (not yet confirmed player) is stored separately
        // This allows players to select avatars before fully joining (character selection phase)
        it('should store avatar in pendingAvatars for unknown socket', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });

            service.updatePlayerAvatar(lobby.lobbyId, 'socket-pending', 'avatar.png');

            const updatedLobby = service.getLobby(lobby.lobbyId);
            expect(updatedLobby.pendingAvatars['socket-pending']).toBe('avatar.png');
        });

        // EDGE CASE: Passing null as avatarPath removes the pending avatar
        // This is used during cleanup when a player cancel avatar selection
        it('should delete pendingAvatar when avatarPath is null', () => {
            const lobby = service.createLobby(mockGame, 'socket-1', { ...mockPlayer, socketId: 'socket-1' });
            const retrievedLobby = service.getLobby(lobby.lobbyId);
            retrievedLobby.pendingAvatars['socket-pending'] = 'avatar.png';

            service.updatePlayerAvatar(lobby.lobbyId, 'socket-pending', null);

            expect(retrievedLobby.pendingAvatars['socket-pending']).toBeUndefined();
        });

        it('should do nothing if lobby does not exist', () => {
            expect(() => service.updatePlayerAvatar('nonexistent', 'socket-1', 'avatar.png')).not.toThrow();
        });
    });
});
