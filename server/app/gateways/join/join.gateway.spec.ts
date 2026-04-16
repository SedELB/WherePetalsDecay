/**
 * Testing: gateway is a pure relay. Each handler delegates to the corresponding flow service.
 */

import { ChatFlowService } from '@app/services/game-logic/core/chat-flow.service';
import { JoinFlowService } from '@app/services/game-logic/core/join-flow.service';
import { JournalBroadcastService } from '@app/services/game-logic/core/journal-broadcast.service';
import { GameMode, PlayerType, VirtualPlayerProfile } from '@common/enums';
import { Game } from '@common/game';
import { Player } from '@common/player';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { JoinGateway } from './join.gateway';

describe('JoinGateway', () => {
    let gateway: JoinGateway;
    let logger: Logger;
    let mockServer: Partial<Server>;
    let mockSocket: Socket;
    let joinFlow: jest.Mocked<JoinFlowService>;
    let chatFlow: jest.Mocked<ChatFlowService>;
    let journalBroadcast: jest.Mocked<JournalBroadcastService>;

    const mockGame: Game = {
        _id: '1', name: 'Test Game', description: 'Test Description',
        size: { rows: 10, cols: 10 }, gameMode: GameMode.Classic, thumbnail: 'test.png',
        maxPlayers: 4, grid: [], isVisible: true,
        createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-01-15'),
    };

    const makeMockPlayer = (): Player => ({
        socketId: '', character: {
            name: 'MOCK_PLAYER', avatar: 'mockavatar.png', life: 0, speed: 0, attack: 0, defense: 0,
            lifeBonus: false, attackDice: 'D4', defenseDice: 'D6',
        },
        isHost: false, winsCount: 0, hasAbandonned: false, playerType: PlayerType.Reel, hasFlag: false,
        combatCount: 0, lossCount: 0, totalHpLost: 0, totalHpDealt: 0, visitedTilesCount: 0,
    });

    beforeEach(async () => {
        mockSocket = { id: 'socket-123' } as Socket;
        mockServer = {};

        const mockJoinFlow = {
            emitAvailableLobbies: jest.fn(),
            deferLobbiesRefresh: jest.fn(),
            createLobby: jest.fn(),
            joinLobby: jest.fn(),
            getStatus: jest.fn(),
            selectAvatar: jest.fn(),
            joinAvatarRoom: jest.fn(),
            toggleLock: jest.fn(),
            kickPlayer: jest.fn(),
            addVirtualPlayer: jest.fn(),
            processPlayerLeave: jest.fn(),
        };
        const mockChatFlow = { handleMessage: jest.fn(), handleHistoryRequest: jest.fn() };
        const mockJournalBroadcast = { initialize: jest.fn(), handleHistoryRequest: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JoinGateway,
                { provide: Logger, useValue: { log: jest.fn() } },
                { provide: JoinFlowService, useValue: mockJoinFlow },
                { provide: ChatFlowService, useValue: mockChatFlow },
                { provide: JournalBroadcastService, useValue: mockJournalBroadcast },
            ],
        }).compile();

        gateway = module.get<JoinGateway>(JoinGateway);
        logger = module.get<Logger>(Logger);
        gateway['server'] = mockServer as Server;
        joinFlow = module.get(JoinFlowService) as jest.Mocked<JoinFlowService>;
        chatFlow = module.get(ChatFlowService) as jest.Mocked<ChatFlowService>;
        journalBroadcast = module.get(JournalBroadcastService) as jest.Mocked<JournalBroadcastService>;
    });

    afterEach(() => jest.clearAllMocks());

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    it('afterInit should log and initialize journal broadcast', () => {
        gateway.afterInit();
        expect(logger.log).toHaveBeenCalledWith('JoinGateway initialized on /join namespace');
        expect(journalBroadcast.initialize).toHaveBeenCalledWith(mockServer);
    });

    it('handleConnection should log connection', () => {
        gateway.handleConnection(mockSocket);
        expect(logger.log).toHaveBeenCalledWith('Player client connected: socket-123');
    });

    it('handleDisconnect should delegate to joinFlow.processPlayerLeave', () => {
        gateway.handleDisconnect(mockSocket);
        expect(joinFlow.processPlayerLeave).toHaveBeenCalledWith(mockServer, mockSocket);
    });

    it('handleLeaveLobby should delegate to joinFlow.processPlayerLeave', () => {
        gateway.handleLeaveLobby(mockSocket);
        expect(joinFlow.processPlayerLeave).toHaveBeenCalledWith(mockServer, mockSocket);
    });

    it('handleCreateLobby should delegate to joinFlow.createLobby', () => {
        const payload = { game: mockGame, player: makeMockPlayer() };
        gateway.handleCreateLobby(mockSocket, payload);
        expect(joinFlow.createLobby).toHaveBeenCalledWith(mockServer, mockSocket, payload);
    });

    it('handleGetLobbies should delegate to joinFlow.emitAvailableLobbies', () => {
        gateway.handleGetLobbies();
        expect(joinFlow.emitAvailableLobbies).toHaveBeenCalledWith(mockServer);
    });

    it('handleStartGameLobbiesRefresh should delegate to joinFlow.deferLobbiesRefresh', () => {
        gateway.handleStartGameLobbiesRefresh();
        expect(joinFlow.deferLobbiesRefresh).toHaveBeenCalledWith(mockServer);
    });

    it('handleLeaveEndGameLobbiesRefresh should delegate to joinFlow.deferLobbiesRefresh', () => {
        gateway.handleLeaveEndGameLobbiesRefresh();
        expect(joinFlow.deferLobbiesRefresh).toHaveBeenCalledWith(mockServer);
    });

    it('handleJoinLobby should delegate to joinFlow.joinLobby', () => {
        const payload = { lobbyId: 'lobby-1', player: makeMockPlayer() };
        gateway.handleJoinLobby(mockSocket, payload);
        expect(joinFlow.joinLobby).toHaveBeenCalledWith(mockServer, mockSocket, payload);
    });

    it('handleGetStatus should delegate to joinFlow.getStatus', () => {
        gateway.handleGetStatus(mockSocket, 'lobby-1');
        expect(joinFlow.getStatus).toHaveBeenCalledWith(mockSocket, 'lobby-1');
    });

    it('handleSelectAvatar should delegate to joinFlow.selectAvatar', () => {
        const payload = { lobbyId: 'lobby-1', avatar: 'avatar.png' };
        gateway.handleSelectAvatar(mockSocket, payload);
        expect(joinFlow.selectAvatar).toHaveBeenCalledWith(mockServer, mockSocket, payload);
    });

    it('handleJoinAvatarRoom should delegate to joinFlow.joinAvatarRoom', () => {
        gateway.handleJoinAvatarRoom(mockSocket, 'lobby-1');
        expect(joinFlow.joinAvatarRoom).toHaveBeenCalledWith(mockSocket, 'lobby-1');
    });

    it('handleToggleLock should delegate to joinFlow.toggleLock', () => {
        gateway.handleToggleLock(mockSocket, 'lobby-1');
        expect(joinFlow.toggleLock).toHaveBeenCalledWith(mockServer, mockSocket, 'lobby-1');
    });

    it('handleKickPlayer should delegate to joinFlow.kickPlayer', () => {
        const payload = { lobbyId: 'lobby-1', targetSocketId: 'target-1' };
        gateway.handleKickPlayer(mockSocket, payload);
        expect(joinFlow.kickPlayer).toHaveBeenCalledWith(mockServer, mockSocket, payload);
    });

    it('handleAddVirtualPlayer should delegate to joinFlow.addVirtualPlayer', () => {
        const payload = { lobbyId: 'lobby-1', profile: VirtualPlayerProfile.Aggressive };
        gateway.handleAddVirtualPlayer(mockSocket, payload);
        expect(joinFlow.addVirtualPlayer).toHaveBeenCalledWith(mockServer, mockSocket, payload);
    });

    it('handleChatMessage should delegate to chatFlow.handleMessage', () => {
        const payload = { lobbyId: 'lobby-1', message: 'hello', senderName: 'Bob' };
        gateway.handleChatMessage(mockSocket, payload);
        expect(chatFlow.handleMessage).toHaveBeenCalledWith(mockServer, mockSocket, payload);
    });

    it('handleChatHistoryRequest should delegate to chatFlow.handleHistoryRequest', () => {
        gateway.handleChatHistoryRequest(mockSocket, 'lobby-1');
        expect(chatFlow.handleHistoryRequest).toHaveBeenCalledWith(mockSocket, 'lobby-1');
    });

    it('handleJournalHistoryRequest should delegate to journalBroadcast.handleHistoryRequest', () => {
        gateway.handleJournalHistoryRequest(mockSocket, 'lobby-1');
        expect(journalBroadcast.handleHistoryRequest).toHaveBeenCalledWith(mockSocket, 'lobby-1');
    });
});
