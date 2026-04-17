import { Test, TestingModule } from '@nestjs/testing';
import { GameTurnSyncService } from './game-turn-sync.service';
import { GameLogicService } from './game-logic.service';
import { PlayerType } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { ActiveGame } from './active-game.interface';
const MOVEMENT_POINTS = 3;
const ACTION_POINTS = 1;
const LOBBY_ID = 'lobby-1';
const SOCKET_ID = 'socket-a';

type EmitSpy = { to: jest.Mock; emit: jest.Mock };

const buildServerSpy = (): EmitSpy & { to: jest.Mock } => {
    const emitFn = jest.fn();
    const toFn = jest.fn().mockReturnValue({ emit: emitFn });
    return { to: toFn, emit: emitFn };
};

const buildMockActiveGame = (overrides: Partial<ActiveGame> = {}): ActiveGame => ({
    lobby: {
        lobbyId: LOBBY_ID,
        gameId: 'game-1',
        hostSocketId: SOCKET_ID,
        playerCount: 1,
        isLocked: true,
        players: [],
        game: {
            _id: 'game-1',
            name: '',
            description: '',
            size: { rows: 3, cols: 3 },
            gameMode: 'classic' as ActiveGame['lobby']['game']['gameMode'],
            thumbnail: '',
            maxPlayers: 4,
            grid: [],
            isVisible: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        pendingAvatars: {},
        chatHistory: [],
        teamA: [],
        teamB: [],
    },
    turnOrder: [SOCKET_ID],
    currentTurnIndex: 0,
    playerPositions: new Map(),
    playerStartPositions: new Map(),
    movementPoints: new Map([[SOCKET_ID, MOVEMENT_POINTS]]),
    actionPoints: new Map([[SOCKET_ID, ACTION_POINTS]]),
    sanctuaryCooldowns: new Map(),
    playerCombatBonuses: new Map(),
    visitedTilesPerPlayer: new Map(),
    globalVisitedTiles: new Set(),
    sanctuariesUsed: new Set(),
    doorsInteracted: new Set(),
    flagHolders: new Set(),
    totalTurns: 0,
    gameStartTime: Date.now(),
    sanctuaryPositions: new Map(),
    doorPositions: [],
    isDebugMode: false,
    ...overrides,
});

describe('GameTurnSyncService', () => {
    let service: GameTurnSyncService;
    let gameLogicMock: jest.Mocked<GameLogicService>;

    beforeEach(async () => {
        gameLogicMock = {
            getMovementPoints: jest.fn().mockReturnValue(MOVEMENT_POINTS),
            getActionPoints: jest.fn().mockReturnValue(ACTION_POINTS),
            getReachableTiles: jest.fn().mockReturnValue([{ x: 1, y: 0 }]),
            getReachableTilesForTeleport: jest.fn().mockReturnValue([]),
            getActiveGame: jest.fn().mockReturnValue(null),
            getAdjacentPlayers: jest.fn().mockReturnValue([]),
            canToggleAdjacentDoor: jest.fn().mockReturnValue(false),
            endTurn: jest.fn(),
        } as unknown as jest.Mocked<GameLogicService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameTurnSyncService,
                { provide: GameLogicService, useValue: gameLogicMock },
            ],
        }).compile();

        service = module.get<GameTurnSyncService>(GameTurnSyncService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('emitMovementPoints', () => {
        /** Emits the current movement points for the specified player to the lobby room. */
        it('should emit MovementPoints to the lobby', () => {
            const server = buildServerSpy();
            service.emitMovementPoints(server as unknown as Parameters<typeof service.emitMovementPoints>[0], LOBBY_ID, SOCKET_ID);
            expect(server.to).toHaveBeenCalledWith(LOBBY_ID);
            expect(server.emit).toHaveBeenCalledWith(JoinGameEvents.MovementPoints, { socketId: SOCKET_ID, movementPoints: MOVEMENT_POINTS });
        });
    });


    describe('emitActionPoints', () => {
        /** Emits the current action points for the specified player to the lobby room. */
        it('should emit ActionPoints to the lobby', () => {
            const server = buildServerSpy();
            service.emitActionPoints(server as unknown as Parameters<typeof service.emitActionPoints>[0], LOBBY_ID, SOCKET_ID);
            expect(server.to).toHaveBeenCalledWith(LOBBY_ID);
            expect(server.emit).toHaveBeenCalledWith(JoinGameEvents.ActionPoints, { socketId: SOCKET_ID, actionPoints: ACTION_POINTS });
        });
    });

    describe('emitReachableTiles', () => {
        /** Emits the reachable tile set for the player to the lobby so the client can highlight them. */
        it('should emit ReachableTiles with the tiles from GameLogicService', () => {
            const server = buildServerSpy();
            service.emitReachableTiles(server as unknown as Parameters<typeof service.emitReachableTiles>[0], LOBBY_ID, SOCKET_ID);
            expect(server.emit).toHaveBeenCalledWith(JoinGameEvents.ReachableTiles, { socketId: SOCKET_ID, tiles: [{ x: 1, y: 0 }] });
        });
    });


    describe('emitReachableTilesForTeleport', () => {
        /** Emits the teleport-eligible tile set for debug-mode movement. */
        it('should emit ReachableTilesForTeleport to the lobby', () => {
            const server = buildServerSpy();
            service.emitReachableTilesForTeleport(
                server as unknown as Parameters<typeof service.emitReachableTilesForTeleport>[0],
                LOBBY_ID,
                SOCKET_ID,
            );
            expect(server.emit).toHaveBeenCalledWith(JoinGameEvents.ReachableTilesForTeleport, { socketId: SOCKET_ID, tiles: [] });
        });
    });


    describe('autoEndTurnIfNoActions', () => {
        /** Does not end the turn automatically when the player can still move. */
        it('should not end the turn when reachable tiles exist', () => {
            gameLogicMock.getActiveGame.mockReturnValue(buildMockActiveGame());
            gameLogicMock.getReachableTiles.mockReturnValue([{ x: 1, y: 0 }]);
            service.autoEndTurnIfNoActions(LOBBY_ID, SOCKET_ID);
            expect(gameLogicMock.endTurn).not.toHaveBeenCalled();
        });

        /** Ends the turn automatically when the player has no movement, no attack, and no door action available. */
        it('should end the turn when no movement, attack, or door action is available', () => {
            gameLogicMock.getActiveGame.mockReturnValue(buildMockActiveGame());
            gameLogicMock.getReachableTiles.mockReturnValue([]);
            gameLogicMock.getActionPoints.mockReturnValue(0);
            gameLogicMock.getAdjacentPlayers.mockReturnValue([]);
            gameLogicMock.canToggleAdjacentDoor.mockReturnValue(false);
            service.autoEndTurnIfNoActions(LOBBY_ID, SOCKET_ID);
            expect(gameLogicMock.endTurn).toHaveBeenCalledWith(LOBBY_ID);
        });

        /** Does not end the turn when debug mode is active, giving the host unrestricted control. */
        it('should not end the turn in debug mode', () => {
            gameLogicMock.getActiveGame.mockReturnValue(buildMockActiveGame({ isDebugMode: true }));
            gameLogicMock.getReachableTiles.mockReturnValue([]);
            service.autoEndTurnIfNoActions(LOBBY_ID, SOCKET_ID);
            expect(gameLogicMock.endTurn).not.toHaveBeenCalled();
        });

        /** Does not end the turn for virtual players, as their AI loop manages its own turn cycle. */
        it('should not auto-end the turn for virtual players', () => {
            const virtualPlayer = {
                socketId: SOCKET_ID,
                playerType: PlayerType.Virtual,
            };
            const game = buildMockActiveGame({
                lobby: {
                    ...buildMockActiveGame().lobby,
                    players: [virtualPlayer as Parameters<typeof buildMockActiveGame>[0]['lobby']['players'][number]],
                },
            });
            gameLogicMock.getActiveGame.mockReturnValue(game);
            gameLogicMock.getReachableTiles.mockReturnValue([]);
            service.autoEndTurnIfNoActions(LOBBY_ID, SOCKET_ID);
            expect(gameLogicMock.endTurn).not.toHaveBeenCalled();
        });

        /** Does not crash when getActiveGame returns null for an unknown lobby. */
        it('should do nothing when the active game is not found', () => {
            gameLogicMock.getActiveGame.mockReturnValue(null);
            expect(() => service.autoEndTurnIfNoActions(LOBBY_ID, SOCKET_ID)).not.toThrow();
            expect(gameLogicMock.endTurn).not.toHaveBeenCalled();
        });
    });


    describe('syncPlayerTurnState', () => {
        /** Emits movement points, action points, and reachable tiles in a single sync call. */
        it('should emit movement points, action points, and reachable tiles', () => {
            const server = buildServerSpy();
            gameLogicMock.getActiveGame.mockReturnValue(buildMockActiveGame());
            gameLogicMock.getReachableTiles.mockReturnValue([]);
            service.syncPlayerTurnState(
                server as unknown as Parameters<typeof service.syncPlayerTurnState>[0],
                LOBBY_ID,
                SOCKET_ID,
            );
            expect(server.emit).toHaveBeenCalledWith(JoinGameEvents.MovementPoints, expect.any(Object));
            expect(server.emit).toHaveBeenCalledWith(JoinGameEvents.ActionPoints, expect.any(Object));
        });
    });
});
