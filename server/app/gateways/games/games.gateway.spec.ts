import { Game } from '@app/model/schema/game.schema';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { GamesGateway } from './games.gateway';
import { PlayerGameEvents } from './games.gateway.events';

describe('GamesGateway', () => {
    let gateway: GamesGateway;
    let logger: Logger;
    let mockServer: Partial<Server>;

    beforeEach(async () => {
        mockServer = {
            emit: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GamesGateway,
                {
                    provide: Logger,
                    useValue: {
                        log: jest.fn(),
                    },
                },
            ],
        }).compile();

        gateway = module.get<GamesGateway>(GamesGateway);
        logger = module.get<Logger>(Logger);
        gateway['server'] = mockServer as Server;
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('afterInit', () => {
        it('should log initialization message', () => {
            gateway.afterInit();
            expect(logger.log).toHaveBeenCalledWith('GamesGateway initialized on /games namespace');
        });
    });

    describe('handleConnection', () => {
        it('should log when player client connects', () => {
            const mockSocket = { id: 'test-socket-id' } as Socket;
            gateway.handleConnection(mockSocket);
            expect(logger.log).toHaveBeenCalledWith('Player client connected: test-socket-id');
        });
    });

    describe('handleDisconnect', () => {
        it('should log when player client disconnects', () => {
            const mockSocket = { id: 'test-socket-id' } as Socket;
            gateway.handleDisconnect(mockSocket);
            expect(logger.log).toHaveBeenCalledWith('Player client disconnected: test-socket-id');
        });
    });

    describe('notifyGameCreated', () => {
        it('should emit GameCreated event with game data', () => {
            const game = new Game();
            game.name = 'Test Game';
            gateway.notifyGameCreated(game);
            expect(mockServer.emit).toHaveBeenCalledWith(PlayerGameEvents.GameCreated, game);
        });
    });

    describe('notifyGameDeleted', () => {
        it('should emit GameDeleted event with game id', () => {
            const gameId = 'game-id-123';
            gateway.notifyGameDeleted(gameId);
            expect(mockServer.emit).toHaveBeenCalledWith(PlayerGameEvents.GameDeleted, gameId);
        });
    });

    describe('notifyGameVisibilityChanged', () => {
        it('should emit GameVisibilityChanged event with gameId and isVisible', () => {
            const gameId = 'game-id-123';
            const isVisible = false;
            gateway.notifyGameVisibilityChanged(gameId, isVisible);
            expect(mockServer.emit).toHaveBeenCalledWith(PlayerGameEvents.GameVisibilityChanged, { gameId, isVisible });
        });
    });
});
