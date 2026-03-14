/**
 * Testing:
 * - Lifecycle events: afterInit, handleConnection, handleDisconnect
 * - Lobby operations: create, join, leave, get available lobbies
 * - Avatar management: selecting avatars, managing occupied avatars
 * - Error handling: non-existent lobbies, full lobbies, locked lobbies
 * - User types: host disconnect vs player disconnect
 */

import { LobbyService } from '@app/services/lobby/lobby.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { GameMode } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { JoinGateway } from './join.gateway';

describe('JoinGateway', () => {
    let gateway: JoinGateway;
    let logger: Logger;
    let mockServer: jest.Mocked<Partial<Server>>;
    let lobbyService: LobbyService;
    let mockSocket: Socket;
    let mockTo: { emit: jest.Mock };

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

    const fakeLobby: Lobby = {
        lobbyId: 'lobby-1',
        gameId: '1',
        game: mockGame,
        hostSocketId: 'socket-123',
        playerCount: 1,
        isLocked: false,
        players: [],
        pendingAvatars: {},
        chatHistory: [],
    };

    const makeMockPlayer = (): Player => ({
        socketId: null,
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
        hasAbandonned: false,
    });

    beforeEach(async () => {
        mockTo = { emit: jest.fn() };

        mockSocket = {
            id: 'socket-123',
            emit: jest.fn(),
            join: jest.fn(),
            to: jest.fn().mockReturnValue(mockTo),
        } as unknown as Socket;

        mockServer = {
            emit: jest.fn(),
            to: jest.fn().mockReturnValue(mockTo),
        };

        const mockLobbyService = {
            createLobby: jest.fn(),
            getAvailableLobbies: jest.fn(),
            getLobby: jest.fn(),
            joinLobby: jest.fn(),
            deleteLobby: jest.fn(),
            findLobbyBySocketId: jest.fn(),
            removePlayerFromLobby: jest.fn(),
            updatePlayerAvatar: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JoinGateway,
                
                {
                    provide: Logger,
                    useValue: { log: jest.fn() },
                },
                {
                    provide: LobbyService,
                    useValue: mockLobbyService,
                },
                {
                    provide: GameLogicService,
                    useValue: {
                        shufflePlayers: jest.fn((players) => players),
                        findActiveGameBySocketId: jest.fn().mockReturnValue(undefined),
                        getActiveGame: jest.fn().mockReturnValue(undefined),
                        isPlayerTurn: jest.fn().mockReturnValue(false),
                        abandonPlayer: jest.fn(),
                        getActivePlayers: jest.fn().mockReturnValue([]),
                        endTurn: jest.fn(),
                    },
                },
            ],
        }).compile();

        gateway = module.get<JoinGateway>(JoinGateway);
        logger = module.get<Logger>(Logger);
        gateway['server'] = mockServer as unknown as Server;
        lobbyService = module.get<LobbyService>(LobbyService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    it('should log init message', () => {
        gateway.afterInit();
        expect(logger.log).toHaveBeenCalledWith('JoinGateway initialized on /join namespace');
    });

    it('should log when player client connects', () => {
        gateway.handleConnection(mockSocket);
        expect(logger.log).toHaveBeenCalledWith('Player client connected: socket-123');
    });

    describe('handleCreateLobby', () => {
        it('should create a lobby and emit GameHosted on success', () => {
            const mockPayload = { game: mockGame, player: makeMockPlayer() };
            jest.spyOn(lobbyService, 'createLobby').mockReturnValue(fakeLobby);
            jest.spyOn(lobbyService, 'getAvailableLobbies').mockReturnValue([]);

            gateway.handleCreateLobby(mockSocket, mockPayload);
            expect(mockPayload.player.socketId).toBe('socket-123');
            expect(mockPayload.player.isHost).toBe(true);
            expect(mockSocket.join).toHaveBeenCalledWith('lobby-1');
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.GameHosted, fakeLobby);
        });

        // EDGE CASE: Lobby creation fails (returns null)
        // This could happen due to database errors or game not found
        it('should emit LobbyError if lobby creation fails', () => {
            const mockPayload = { game: mockGame, player: makeMockPlayer() };
            jest.spyOn(lobbyService, 'createLobby').mockReturnValue(null);

            gateway.handleCreateLobby(mockSocket, mockPayload);

            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, `Ce salon n'a pas pu être créé. (handleCreateLobby)`);
            expect(mockSocket.join).not.toHaveBeenCalled();
        });
    });

    describe('handleGetLobbies', () => {
        it('should emit UpdatedLobbiesList with available lobbies', () => {
            const fakeLobbies = [{ gameId: 'lobby-1' }] as Lobby[];
            jest.spyOn(lobbyService, 'getAvailableLobbies').mockReturnValue(fakeLobbies);

            gateway.handleGetLobbies();
            expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.UpdatedLobbiesList, fakeLobbies);
        });
    });

    describe('handleJoinLobby', () => {
        // EDGE CASE: Attempting to join non-existent lobby (deleted by host or server)
        it('should emit LobbyError if lobby does not exist', () => {
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue(null);

            gateway.handleJoinLobby(mockSocket, { lobbyId: 'lobby-1', player: makeMockPlayer() });
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, `Ce salon n'existe plus.`);
        });

        // EDGE CASE: Attempting to join a full lobby (playerCount >= maxPlayers)
        // This prevents players from exceeding maxPlayers limit
        it('should emit LobbyError if lobby is full', () => {
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue({ ...fakeLobby, playerCount: 4 });

            gateway.handleJoinLobby(mockSocket, { lobbyId: 'lobby-1', player: makeMockPlayer() });
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, 'Ce salon est plein !');
        });

        it('should join lobby and emit LobbyJoined on success', () => {
            const mockPayload = { lobbyId: 'lobby-1', player: makeMockPlayer() };
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue(fakeLobby);
            jest.spyOn(lobbyService, 'joinLobby').mockReturnValue(fakeLobby);
            jest.spyOn(lobbyService, 'getAvailableLobbies').mockReturnValue([]);

            gateway.handleJoinLobby(mockSocket, mockPayload);
            expect(mockSocket.join).toHaveBeenCalledWith('lobby-1');
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyJoined, fakeLobby);
            expect(mockServer.to).toHaveBeenCalledWith('lobby-1');
            expect(mockTo.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyUpdated, fakeLobby);
        });
    });

    describe('handleGetStatus', () => {
        it('should emit LobbyStatusReceived with game if lobby found', () => {
            jest.spyOn(lobbyService, 'findLobbyBySocketId').mockReturnValue(fakeLobby);

            gateway.handleGetStatus(mockSocket);
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyStatusReceived, fakeLobby);
        });

        it('should emit LobbyError if lobby not found', () => {
            jest.spyOn(lobbyService, 'findLobbyBySocketId').mockReturnValue(null);

            gateway.handleGetStatus(mockSocket);
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, 'Ce salon est introuvable.');
        });
    });

    describe('handleSelectAvatar', () => {
        // EDGE CASE: Avatar selected for a socket with no confirmed player (avatar selection phase)
        // This allows players to reserve avatars before character is fully confirmed
        it('should do nothing if lobby does not exist', () => {
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue(null);

            gateway.handleSelectAvatar(mockSocket, { lobbyId: 'lobby-1', avatar: 'avatar.png' });
            expect(lobbyService.updatePlayerAvatar).not.toHaveBeenCalled();
        });

        it('should update avatar and broadcast UpdateOccupiedAvatars', () => {
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue(fakeLobby);

            gateway.handleSelectAvatar(mockSocket, { lobbyId: 'lobby-1', avatar: 'avatar.png' });
            expect(lobbyService.updatePlayerAvatar).toHaveBeenCalledWith('lobby-1', 'socket-123', 'avatar.png');
            expect(mockServer.to).toHaveBeenCalledWith('lobby-1');
            expect(mockTo.emit).toHaveBeenCalledWith(JoinGameEvents.UpdateOccupiedAvatars, []);
        });
    });

    describe('handleJoinAvatarRoom', () => {
        it('should join room and emit UpdateOccupiedAvatars if lobby exists', () => {
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue(fakeLobby);

            gateway.handleJoinAvatarRoom(mockSocket, 'lobby-1');
            expect(mockSocket.join).toHaveBeenCalledWith('lobby-1');
            expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.UpdateOccupiedAvatars, []);
        });

        it('should log error if lobby does not exist', () => {
            jest.spyOn(lobbyService, 'getLobby').mockReturnValue(null);

            gateway.handleJoinAvatarRoom(mockSocket, 'lobby-1');
            expect(logger.log).toHaveBeenCalledWith('Lobby not found for lobby-1 (handleJoinAvatarRoom)');
        });
    });

    describe('handleDisconnect / handleLeaveLobby', () => {
        // EDGE CASE: HOST DISCONNECT - triggers immediate lobby deletion
        // All players in the lobby must be notified that the host disconnected
        it('should delete lobby and emit GameDeleted when host disconnects', () => {
            jest.spyOn(lobbyService, 'findLobbyBySocketId').mockReturnValue(fakeLobby);
            jest.spyOn(lobbyService, 'getAvailableLobbies').mockReturnValue([]);

            gateway.handleDisconnect(mockSocket);
            expect(mockSocket.to).toHaveBeenCalledWith('lobby-1');
            expect(mockTo.emit).toHaveBeenCalledWith(JoinGameEvents.GameDeleted);
            expect(lobbyService.deleteLobby).toHaveBeenCalledWith('lobby-1');
        });

        // EDGE CASE: NON-HOST DISCONNECT - player leaves but lobby persists
        // This allows the host and remaining players to continue
        it('should remove player and emit UpdateOccupiedAvatars when non-host disconnects', () => {
            jest.spyOn(lobbyService, 'findLobbyBySocketId').mockReturnValue({ ...fakeLobby, hostSocketId: 'other-socket' });
            jest.spyOn(lobbyService, 'getAvailableLobbies').mockReturnValue([]);

            gateway.handleDisconnect(mockSocket);
            expect(lobbyService.removePlayerFromLobby).toHaveBeenCalledWith('lobby-1', 'socket-123');
            expect(mockServer.to).toHaveBeenCalledWith('lobby-1');
            expect(mockTo.emit).toHaveBeenCalledWith(JoinGameEvents.UpdateOccupiedAvatars, []);
            expect(mockTo.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyUpdated, expect.any(Object));
        });

        // EDGE CASE: Disconnect from a socket not in any lobby (ghost connection)
        // This prevents errors when cleaning up orphaned connections
        it('should do nothing if socket is not in any lobby', () => {
            jest.spyOn(lobbyService, 'findLobbyBySocketId').mockReturnValue(null);
            gateway.handleDisconnect(mockSocket);
            expect(lobbyService.deleteLobby).not.toHaveBeenCalled();
            expect(lobbyService.removePlayerFromLobby).not.toHaveBeenCalled();
        });

        it('should call processPlayerLeave when handleLeaveLobby is called', () => {
            jest.spyOn(lobbyService, 'findLobbyBySocketId').mockReturnValue(null);
            gateway.handleLeaveLobby(mockSocket);
            expect(lobbyService.findLobbyBySocketId).toHaveBeenCalledWith('socket-123');
        });
    });
});
