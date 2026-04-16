import { JoinFlowService } from '@app/services/join-flow.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { DiceType, GameMode, PlayerType, VirtualPlayerProfile } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';

describe('JoinFlowService', () => {
    let service: JoinFlowService;
    let lobbyService: jest.Mocked<LobbyService>;
    let mockServer: jest.Mocked<Server>;
    let mockSocket: jest.Mocked<Socket>;

    const mockGame: Game = {
        _id: '1', name: 'Test Game', description: 'Desc', size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic, thumbnail: 't.png', maxPlayers: 4, grid: [],
        isVisible: true, createdAt: new Date(), updatedAt: new Date(),
    };

    const buildPlayer = (id: string, name = 'Player'): Player => ({
        socketId: id, character: {
            name, avatar: 'a.png', life: 10, speed: 10, attack: 10, defense: 10,
            lifeBonus: false, attackDice: DiceType.D6, defenseDice: DiceType.D6,
        },
        isHost: false, winsCount: 0, hasAbandonned: false, playerType: PlayerType.Reel, hasFlag: false,
        combatCount: 0, lossCount: 0, totalHpLost: 0, totalHpDealt: 0, visitedTilesCount: 0,
    });

    const buildLobby = (id: string): Lobby => ({
        lobbyId: id, gameId: '1', game: mockGame, hostSocketId: 'host-1', playerCount: 1,
        isLocked: false, players: [buildPlayer('host-1', 'Host')], pendingAvatars: {},
        chatHistory: [], teamA: [], teamB: [],
    });

    beforeEach(async () => {
        mockServer = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            socketsLeave: jest.fn(),
        } as unknown as jest.Mocked<Server>;
        const broadcastMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
        mockSocket = {
            id: 'socket-1',
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
            broadcast: broadcastMock,
        } as unknown as jest.Mocked<Socket>;
        (mockSocket.broadcast.to as jest.Mock).mockReturnValue(broadcastMock);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JoinFlowService,
                { provide: Logger, useValue: { log: jest.fn() } },
                {
                    provide: LobbyService, useValue: {
                        getAvailableLobbies: jest.fn(), initializeRealPlayer: jest.fn(), createLobby: jest.fn(),
                        getLobby: jest.fn(), getLobbyValidationError: jest.fn(), getValidName: jest.fn(),
                        joinLobby: jest.fn(), findLobbyBySocketId: jest.fn(), updatePlayerAvatar: jest.fn(),
                        getOccupiedAvatars: jest.fn(), toggleLock: jest.fn(), kickPlayer: jest.fn(),
                        addVirtualPlayerToLobby: jest.fn(), removePlayerFromLobby: jest.fn(), deleteLobby: jest.fn(),
                    },
                },
                { provide: GameLogicService, useValue: { getActiveGame: jest.fn() } },
            ],
        }).compile();

        service = module.get<JoinFlowService>(JoinFlowService);
        lobbyService = module.get(LobbyService);
    });

    it('emitAvailableLobbies should emit lobbies list', () => {
        lobbyService.getAvailableLobbies.mockReturnValue([]);
        service.emitAvailableLobbies(mockServer);
        expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.UpdatedLobbiesList, []);
    });

    it('createLobby should handle success and failure', () => {
        const payload = { game: mockGame, player: buildPlayer('host-1') };
        lobbyService.createLobby.mockReturnValue(buildLobby('L1'));
        
        service.createLobby(mockServer, mockSocket, payload);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.GameHosted, expect.anything());
        
        lobbyService.createLobby.mockReturnValue(null);
        service.createLobby(mockServer, mockSocket, payload);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, expect.stringContaining('pas pu être créé'));
    });

    it('joinLobby should handle success, validation error and avatar conflict', () => {
        const payload = { lobbyId: 'L1', player: buildPlayer('p2') };
        lobbyService.getLobby.mockReturnValue(buildLobby('L1'));
        
        lobbyService.getLobbyValidationError.mockReturnValue('Full');
        service.joinLobby(mockServer, mockSocket, payload);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, 'Full');

        lobbyService.getLobbyValidationError.mockReturnValue(undefined);
        lobbyService.joinLobby.mockImplementation(() => {
            throw new Error('Avatar already taken');
        });
        service.joinLobby(mockServer, mockSocket, payload);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, expect.stringContaining('n\'est plus disponible'));

        lobbyService.joinLobby.mockImplementation(() => buildLobby('L1'));
        service.joinLobby(mockServer, mockSocket, payload);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyJoined, expect.anything());
    });

    it('getStatus should join room and emit lobby', () => {
        lobbyService.findLobbyBySocketId.mockReturnValue(buildLobby('L1'));
        service.getStatus(mockSocket);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyStatusReceived, expect.anything());

        lobbyService.findLobbyBySocketId.mockReturnValue(null);
        service.getStatus(mockSocket);
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.LobbyError, expect.anything());
    });

    it('selectAvatar and joinAvatarRoom should update avatars', () => {
        lobbyService.getLobby.mockReturnValue(buildLobby('L1'));
        lobbyService.getOccupiedAvatars.mockReturnValue(['a1']);
        service.selectAvatar(mockServer, mockSocket, { lobbyId: 'L1', avatar: 'path' });
        expect(lobbyService.updatePlayerAvatar).toHaveBeenCalled();

        service.joinAvatarRoom(mockSocket, 'L1');
        expect(mockSocket.emit).toHaveBeenCalledWith(JoinGameEvents.UpdateOccupiedAvatars, ['a1']);
    });

    it('toggleLock and kickPlayer should delegate to lobbyService', () => {
        lobbyService.toggleLock.mockReturnValue(buildLobby('L1'));
        service.toggleLock(mockServer, mockSocket, 'L1');
        expect(mockServer.to).toHaveBeenCalled();

        lobbyService.kickPlayer.mockReturnValue(true);
        lobbyService.getLobby.mockReturnValue(buildLobby('L1'));
        service.kickPlayer(mockServer, mockSocket, { lobbyId: 'L1', targetSocketId: 't1' });
        expect(mockServer.to).toHaveBeenCalledWith('t1');
    });

    it('addVirtualPlayer should emit join events on success', () => {
        const lobby = buildLobby('L1');
        lobby.players.push(buildPlayer('v1'));
        lobbyService.addVirtualPlayerToLobby.mockReturnValue(lobby);
        service.addVirtualPlayer(mockServer, mockSocket, { lobbyId: 'L1', profile: VirtualPlayerProfile.Aggressive });
        expect(mockServer.to).toHaveBeenCalledWith('L1');
    });

    it('processPlayerLeave should handle host leaving vs normal player leaving', () => {
        const lobby = buildLobby('L1');
        lobbyService.findLobbyBySocketId.mockReturnValue(lobby);
        
        // Host leaves
        (mockSocket as unknown as { id: string }).id = 'host-1';
        service.processPlayerLeave(mockServer, mockSocket);
        expect(mockSocket.to).toHaveBeenCalledWith('L1');
        expect(lobbyService.deleteLobby).toHaveBeenCalledWith('L1');

        // Normal player leaves
        (mockSocket as unknown as { id: string }).id = 'p2';
        lobby.players.push(buildPlayer('p2'));
        service.processPlayerLeave(mockServer, mockSocket);
        expect(lobbyService.removePlayerFromLobby).toHaveBeenCalledWith('L1', 'p2');
    });
});
