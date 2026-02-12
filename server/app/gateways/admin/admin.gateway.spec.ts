import { Game } from '@app/model/schema/game.schema';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { AdminGateway } from './admin.gateway';
import { AdminGameEvents } from './admin.gateway.events';

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
        expect(gateway).toBeDefined();
    });

    describe('afterInit', () => {
        it('should log initialization message', () => {
            gateway.afterInit();
            expect(logger.log).toHaveBeenCalledWith('AdminGateway initialized on admin namespace');
        });
    });

    describe('handleConnection', () => {
        it('should log when admin client connects', () => {
            const mockSocket = { id: 'test-socket-id' } as Socket;
            gateway.handleConnection(mockSocket);
            expect(logger.log).toHaveBeenCalledWith('Admin client connected: test-socket-id');
        });
    });

    describe('handleDisconnect', () => {
        it('should log when admin client disconnects', () => {
            const mockSocket = { id: 'test-socket-id' } as Socket;
            gateway.handleDisconnect(mockSocket);
            expect(logger.log).toHaveBeenCalledWith('Admin client disconnected: test-socket-id');
        });
    });

    describe('notifyGameCreated', () => {
        it('should emit GameCreated event with game data', () => {
            const game = new Game();
            game.name = 'Test Game';
            gateway.notifyGameCreated(game);
            expect(mockServer.emit).toHaveBeenCalledWith(AdminGameEvents.GameCreated, game);
        });
    });

    describe('notifyGameUpdated', () => {
        it('should emit GameUpdated event with game data', () => {
            const game = new Game();
            game.name = 'Updated Game';
            gateway.notifyGameUpdated(game);
            expect(mockServer.emit).toHaveBeenCalledWith(AdminGameEvents.GameUpdated, game);
        });
    });

    describe('notifyGameDeleted', () => {
        it('should emit GameDeleted event with game id', () => {
            const gameId = 'game-id-123';
            gateway.notifyGameDeleted(gameId);
            expect(mockServer.emit).toHaveBeenCalledWith(AdminGameEvents.GameDeleted, gameId);
        });
    });

    describe('notifyGameVisibilityChanged', () => {
        it('should emit GameVisibilityChanged event with gameId and isVisible', () => {
            const gameId = 'game-id-123';
            const isVisible = true;
            gateway.notifyGameVisibilityChanged(gameId, isVisible);
            expect(mockServer.emit).toHaveBeenCalledWith(AdminGameEvents.GameVisibilityChanged, { gameId, isVisible });
        });
    });

    describe('notifyGamesUpdated', () => {
        it('should emit GamesUpdated event', () => {
            gateway.notifyGamesUpdated();
            expect(mockServer.emit).toHaveBeenCalledWith(AdminGameEvents.GamesUpdated);
        });
    });
});
