import {
    getFirstTurnNotification,
    getNextTurnNotification,
} from '@app/services/game-view/game-view-notification.utils';
import { DiceType, PlayerType, TileTexture } from '@common/enums';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';

// Constants
const DEFAULT_LIFE = 6;
const BASE_SPEED = 4;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;

const SOCKET_A = 'socket-a';
const SOCKET_B = 'socket-b';
const SOCKET_C = 'socket-c';
const LOCAL_SOCKET = SOCKET_A;

// Factories

const buildPlayer = (socketId: string, overrides: Partial<Player> = {}): Player => ({
    socketId,
    isHost: false,
    winsCount: 0,
    hasAbandonned: false,
    playerType: PlayerType.Reel,
    hasFlag: false,
    combatCount: 0,
    lossCount: 0,
    totalHpLost: 0,
    totalHpDealt: 0,
    visitedTilesCount: 0,
    character: {
        name: `Player-${socketId}`,
        avatar: '',
        life: DEFAULT_LIFE,
        speed: BASE_SPEED,
        attack: BASE_ATTACK,
        defense: BASE_DEFENSE,
        lifeBonus: false,
        attackDice: DiceType.D6,
        defenseDice: DiceType.D4,
    },
    ...overrides,
});

const buildLobby = (players: Player[]): Lobby => ({
    lobbyId: 'lobby-1',
    gameId: 'game-1',
    hostSocketId: SOCKET_A,
    playerCount: players.length,
    isLocked: true,
    players,
    game: {
        _id: 'game-1',
        name: 'Test',
        description: '',
        size: { rows: 3, cols: 3 },
        gameMode: 'classic' as Lobby['game']['gameMode'],
        thumbnail: '',
        maxPlayers: 4,
        grid: [[{ type: TileTexture.Floor, item: null }]],
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    pendingAvatars: {},
    chatHistory: [],
    teamA: [],
    teamB: [],
});

describe('game-view-notification.utils', () => {

    describe('getNextTurnNotification', () => {
        const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B), buildPlayer(SOCKET_C)];
        const lobby = buildLobby(players);
        const order = [SOCKET_A, SOCKET_B, SOCKET_C];

        /** Returns the first-person French phrase when the upcoming turn belongs to the local player. */
        it('should return "C\'est bientôt votre tour !" for the local player', () => {
            const result = getNextTurnNotification(order, lobby, SOCKET_C, LOCAL_SOCKET);
            expect(result).toBe('C\'est bientôt votre tour !');
        });

        /** Returns the third-person phrase with the player name when the next turn belongs to an opponent. */
        it('should return the next player name for an opponent turn', () => {
            const result = getNextTurnNotification(order, lobby, SOCKET_A, SOCKET_C);
            expect(result).toBe(`C'est bientôt le tour de Player-${SOCKET_B}`);
        });

        /** Returns null when the lobby is null, preventing a toast from appearing with no context. */
        it('should return null when lobby is null', () => {
            expect(getNextTurnNotification(order, null, SOCKET_A, LOCAL_SOCKET)).toBeNull();
        });

        /** Returns null when the order array is empty, as there is no next player to announce. */
        it('should return null when order is empty', () => {
            expect(getNextTurnNotification([], lobby, SOCKET_A, LOCAL_SOCKET)).toBeNull();
        });

        /** Returns null when the ended player socket ID is not found in the turn order. */
        it('should return null when endedPlayerSocketId is not in order', () => {
            expect(getNextTurnNotification(order, lobby, 'ghost', LOCAL_SOCKET)).toBeNull();
        });

        /** Skips abandoned players when searching for the next active turn candidate. */
        it('should skip abandoned players when finding the next turn', () => {
            const lobbyWithAbandon = buildLobby([
                buildPlayer(SOCKET_A),
                buildPlayer(SOCKET_B, { hasAbandonned: true }),
                buildPlayer(SOCKET_C),
            ]);
            const result = getNextTurnNotification(order, lobbyWithAbandon, SOCKET_A, 'spectator');
            expect(result).toBe(`C'est bientôt le tour de Player-${SOCKET_C}`);
        });
    });

    describe('getFirstTurnNotification', () => {
        const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B)];
        const lobby = buildLobby(players);
        const order = [SOCKET_A, SOCKET_B];

        /** Returns the first-person phrase when the very first turn goes to the local player. */
        it('should return "C\'est bientôt votre tour !" when local player goes first', () => {
            const result = getFirstTurnNotification(order, lobby, LOCAL_SOCKET);
            expect(result).toBe('C\'est bientôt votre tour !');
        });

        /** Returns the third-person phrase with the first player name when an opponent goes first. */
        it('should return the first player name when an opponent goes first', () => {
            const result = getFirstTurnNotification(order, lobby, SOCKET_B);
            expect(result).toBe(`C'est bientôt le tour de Player-${SOCKET_A}`);
        });

        /** Returns null when the order array is empty, as no announcement can be made. */
        it('should return null when order is empty', () => {
            expect(getFirstTurnNotification([], lobby, LOCAL_SOCKET)).toBeNull();
        });

        /** Returns null when the first socket in the order does not match any player in the lobby. */
        it('should return null when the first player is not found in lobby', () => {
            const result = getFirstTurnNotification(['ghost'], lobby, LOCAL_SOCKET);
            expect(result).toBeNull();
        });
    });
});
