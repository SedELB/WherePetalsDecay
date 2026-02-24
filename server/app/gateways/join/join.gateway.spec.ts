import { Game } from '@app/model/schema/game.schema';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { AdminGateway } from './join.gateway';
import { JoinGameEvents } from './join.gateway.events';

describe('AdminGateway', () => {
    let gateway: AdminGateway;
    let logger: Logger;
    let mockServer: Partial<Server>;

    beforeEach(async () => {
        mockServer = {
            emit: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminGateway,
                {
                    provide: Logger,
                    useValue: {
                        log: jest.fn(),
                    },
                },
            ],
        }).compile();

        gateway = module.get<AdminGateway>(AdminGateway);
        logger = module.get<Logger>(Logger);
        gateway['server'] = mockServer as Server;
    });

    it('should be defined', () => {
        // Ensures AdminGateway instance is properly created and injected
        expect(gateway).toBeDefined();
    });

    describe('afterInit', () => {
        // Verifies gateway logs initialization message to admin namespace
        it('should log initialization message', () => {
            gateway.afterInit();
            expect(logger.log).toHaveBeenCalledWith('AdminGateway initialized on admin namespace');
        });
    });

    describe('handleConnection', () => {
        // Confirms gateway logs when admin clients connect with socket id
        it('should log when admin client connects', () => {
            const mockSocket = { id: 'test-socket-id' } as Socket;
            gateway.handleConnection(mockSocket);
            expect(logger.log).toHaveBeenCalledWith('Admin client connected: test-socket-id');
        });
    });

    describe('handleDisconnect', () => {
        // Confirms gateway logs when admin clients disconnect with socket id
        it('should log when admin client disconnects', () => {
            const mockSocket = { id: 'test-socket-id' } as Socket;
            gateway.handleDisconnect(mockSocket);
            expect(logger.log).toHaveBeenCalledWith('Admin client disconnected: test-socket-id');
        });
    });

    describe('notifyGameCreated', () => {
        // Broadcasts newly created game data to all admin clients
        it('should emit GameCreated event with game data', () => {
            const game = new Game();
            game.name = 'Test Game';
            gateway.notifyGameHosted(game);
            expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.GameHosted, game);
        });
    });

    describe('notifyGameUpdated', () => {
        // Broadcasts updated game data to all admin clients
        it('should emit GameUpdated event with game data', () => {
            const game = new Game();
            game.name = 'Updated Game';
            gateway.notifyGameUpdated(game);
            expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.GameUpdated, game);
        });
    });

    describe('notifyGameDeleted', () => {
        // Broadcasts game deletion notification to all admin clients
        it('should emit GameDeleted event with game id', () => {
            const gameId = 'game-id-123';
            gateway.notifyGameDeleted(gameId);
            expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.GameDeleted, gameId);
        });
    });

    describe('notifyGameVisibilityChanged', () => {
        // Broadcasts game visibility state changes to all admin clients
        it('should emit GameVisibilityChanged event with gameId and isVisible', () => {
            const gameId = 'game-id-123';
            const isVisible = true;
            gateway.notifyGameVisibilityChanged(gameId, isVisible);
            expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.GameVisibilityChanged, { gameId, isVisible });
        });
    });

    describe('notifyGamesUpdated', () => {
        // Notifies admin clients that games list has been updated
        it('should emit GamesUpdated event', () => {
            gateway.notifyGamesUpdated();
            expect(mockServer.emit).toHaveBeenCalledWith(JoinGameEvents.GamesUpdated);
        });
    });
});
