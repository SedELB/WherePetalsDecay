import { TestBed } from '@angular/core/testing';
import { GameLogicService, HasAnyActionParams } from '@app/services/game-view/game-logic.service';
import { DiceType, PlayerType, TileTexture } from '@common/enums';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

// Constants
const DEFAULT_LIFE = 6;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;
const BASE_SPEED = 4;
const FORMAT_THRESHOLD_MINUS_ONE = 9;
const FORMAT_THRESHOLD_VALUE = 10;

const SOCKET_A = 'socket-a';
const SOCKET_B = 'socket-b';
const SOCKET_C = 'socket-c';

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
        avatar: 'avatar.png',
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

const buildFloorTile = (): Tile => ({ type: TileTexture.Floor, item: null });
const buildDoorClosedTile = (): Tile => ({ type: TileTexture.DoorClosed, item: null });
const buildDoorOpenedTile = (): Tile => ({ type: TileTexture.DoorOpened, item: null });
const buildIceTile = (): Tile => ({ type: TileTexture.Ice, item: null });

const build3x3Grid = (): Tile[][] => [
    [buildFloorTile(), buildFloorTile(), buildFloorTile()],
    [buildFloorTile(), buildFloorTile(), buildFloorTile()],
    [buildFloorTile(), buildFloorTile(), buildFloorTile()],
];

describe('GameLogicService', () => {
    let service: GameLogicService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [GameLogicService] });
        service = TestBed.inject(GameLogicService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('isPlayerInTeam', () => {
        const team = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B)];

        /** Returns true when the socket ID matches a member of the given team array. */
        it('should return true for a player in the team', () => {
            expect(service.isPlayerInTeam(team, SOCKET_A)).toBe(true);
        });

        /** Returns false for a socket ID that does not belong to any team member. */
        it('should return false for a player not in the team', () => {
            expect(service.isPlayerInTeam(team, SOCKET_C)).toBe(false);
        });

        /** Returns false gracefully when the team array is completely empty. */
        it('should return false for an empty team', () => {
            expect(service.isPlayerInTeam([], SOCKET_A)).toBe(false);
        });
    });

    describe('arePlayersTeammates', () => {
        const teamA = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B)];
        const teamB = [buildPlayer(SOCKET_C)];

        /** Correctly identifies two players as teammates when they share the same team. */
        it('should return true when both players are in the same team', () => {
            expect(service.arePlayersTeammates(SOCKET_A, SOCKET_B, [teamA, teamB])).toBe(true);
        });

        /** Returns false when comparing players who belong to opposing teams. */
        it('should return false for players in different teams', () => {
            expect(service.arePlayersTeammates(SOCKET_A, SOCKET_C, [teamA, teamB])).toBe(false);
        });

        /** Returns false when the teams array is empty. */
        it('should return false when teams array is empty', () => {
            expect(service.arePlayersTeammates(SOCKET_A, SOCKET_B, [])).toBe(false);
        });
    });

    describe('getTeamPlayers', () => {
        const playerA = buildPlayer(SOCKET_A);
        const playerB = buildPlayer(SOCKET_B);
        const playerC = buildPlayer(SOCKET_C);
        const lobby = { teamA: [playerA], teamB: [playerB, playerC], players: [playerA, playerB, playerC] } as unknown as Lobby;

        /** Filters the ordered player list to only those belonging to team A. */
        it('should return players from team A in ordered list', () => {
            const result = service.getTeamPlayers('A', lobby, [playerA, playerB, playerC]);
            expect(result.length).toBe(1);
            expect(result[0].socketId).toBe(SOCKET_A);
        });

        /** Returns an empty array when the lobby is null. */
        it('should return empty array when lobby is null', () => {
            expect(service.getTeamPlayers('A', null, [playerA])).toEqual([]);
        });

        /** Returns an empty array when orderedPlayers is null. */
        it('should return empty array when orderedPlayers is null', () => {
            expect(service.getTeamPlayers('A', lobby, null)).toEqual([]);
        });
    });

    describe('getOrderedPlayers', () => {
        const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B), buildPlayer(SOCKET_C)];

        /** Arranges the player array to match the server-provided turn order. */
        it('should return players sorted by turn order', () => {
            const result = service.getOrderedPlayers([SOCKET_B, SOCKET_A, SOCKET_C], players, null);
            expect(result[0].socketId).toBe(SOCKET_B);
        });

        /** Rotates the list so the active player is always first. */
        it('should rotate so the active player is first', () => {
            const result = service.getOrderedPlayers([SOCKET_A, SOCKET_B, SOCKET_C], players, SOCKET_B);
            expect(result[0].socketId).toBe(SOCKET_B);
        });

        /** Falls back to the raw player list when no turn order has been received. */
        it('should return original player list when turnOrder is empty', () => {
            expect(service.getOrderedPlayers([], players, null)).toEqual(players);
        });

        /** Silently omits socket IDs that have no matching player object. */
        it('should skip socket IDs with no matching player', () => {
            const result = service.getOrderedPlayers(['ghost', SOCKET_A], players, null);
            expect(result.length).toBe(1);
        });
    });

    describe('getAdjacentPlayers', () => {
        const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B)];

        /** Identifies opponents standing on cardinal-adjacent tiles when it is my turn. */
        it('should return cardinal-adjacent players on my turn and ignore diagonals/abandoned/not-my-turn', () => {
            const pos: Record<string, Vec2> = { [SOCKET_A]: { x: 2, y: 2 }, [SOCKET_B]: { x: 3, y: 2 } };
            expect(service.getAdjacentPlayers(true, SOCKET_A, pos, players).length).toBe(1);
            expect(service.getAdjacentPlayers(false, SOCKET_A, pos, players)).toEqual([]);

            const diagPos: Record<string, Vec2> = { [SOCKET_A]: { x: 2, y: 2 }, [SOCKET_B]: { x: 3, y: 3 } };
            expect(service.getAdjacentPlayers(true, SOCKET_A, diagPos, players)).toEqual([]);

            const abandonned = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B, { hasAbandonned: true })];
            expect(service.getAdjacentPlayers(true, SOCKET_A, pos, abandonned)).toEqual([]);
        });
    });

    describe('getAdjacentDoorTiles', () => {
        /** Returns adjacent door tiles when it is the player's turn. */
        it('should return adjacent door tiles on my turn', () => {
            const grid: Tile[][] = [
                [buildFloorTile(), buildFloorTile(), buildFloorTile()],
                [buildDoorClosedTile(), buildFloorTile(), buildFloorTile()],
                [buildFloorTile(), buildFloorTile(), buildFloorTile()],
            ];
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 1, y: 1 } };
            expect(service.getAdjacentDoorTiles(true, SOCKET_A, positions, grid).length).toBe(1);
        });

        /** Returns empty when no adjacent doors exist. */
        it('should return empty when no adjacent doors', () => {
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 1, y: 1 } };
            expect(service.getAdjacentDoorTiles(true, SOCKET_A, positions, build3x3Grid())).toEqual([]);
        });

        /** Returns empty when grid is undefined. */
        it('should return empty when grid is undefined', () => {
            expect(service.getAdjacentDoorTiles(true, SOCKET_A, {}, undefined)).toEqual([]);
        });

        /** Also returns opened doors as valid interaction targets. */
        it('should return opened door tiles as well', () => {
            const grid: Tile[][] = [
                [buildFloorTile(), buildDoorOpenedTile(), buildFloorTile()],
                [buildFloorTile(), buildFloorTile(), buildFloorTile()],
                [buildFloorTile(), buildFloorTile(), buildFloorTile()],
            ];
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 1, y: 1 } };
            expect(service.getAdjacentDoorTiles(true, SOCKET_A, positions, grid).length).toBe(1);
        });
    });

    describe('getPlayerAtPosition', () => {
        /** Returns the socket ID of the player at the queried coordinates. */
        it('should return the socketId of the player at given coords', () => {
            const POS_X = 3;
            const POS_Y = 5;
            expect(service.getPlayerAtPosition(POS_X, POS_Y, { [SOCKET_A]: { x: POS_X, y: POS_Y } })).toBe(SOCKET_A);
        });

        /** Returns null when no player occupies the queried tile. */
        it('should return null when no player is at given coords', () => {
            expect(service.getPlayerAtPosition(0, 0, { [SOCKET_A]: { x: 3, y: 5 } })).toBeNull();
        });
    });

    describe('getPlayerName', () => {
        const players = [buildPlayer(SOCKET_A)];

        /** Retrieves the character name for a known socket ID. */
        it('should return the character name for a known socket', () => {
            expect(service.getPlayerName(SOCKET_A, players)).toBe(`Player-${SOCKET_A}`);
        });

        /** Falls back to "Un joueur" for an unknown socket. */
        it('should fall back to "Un joueur" for an unknown socket', () => {
            expect(service.getPlayerName('ghost', players)).toBe('Un joueur');
        });
    });

    describe('getTimerLabel', () => {
        const players = [buildPlayer(SOCKET_A), buildPlayer(SOCKET_B)];

        /** Shows "Votre tour" when it is the local player's turn. */
        it('should return "Votre tour" when it is the local player turn', () => {
            expect(service.getTimerLabel(SOCKET_A, SOCKET_A, players)).toBe('Votre tour');
        });

        /** Shows the opponent's name when someone else is active. */
        it('should return the active player name when it is someone else\'s turn', () => {
            expect(service.getTimerLabel(SOCKET_B, SOCKET_A, players)).toBe(`Tour de Player-${SOCKET_B}`);
        });

        /** Shows "Prochain tour..." between turns. */
        it('should return "Prochain tour..." when activeId is null', () => {
            expect(service.getTimerLabel(null, SOCKET_A, players)).toBe('Prochain tour...');
        });
    });

    describe('getTimerDisplay', () => {
        /** Pads single-digit countdowns with a leading zero. */
        it('should pad single-digit countdowns', () => {
            expect(service.getTimerDisplay(FORMAT_THRESHOLD_MINUS_ONE, SOCKET_A)).toBe('00:09');
        });

        /** Does not pad two-digit countdown values. */
        it('should not pad two-digit countdowns', () => {
            expect(service.getTimerDisplay(FORMAT_THRESHOLD_VALUE, SOCKET_A)).toBe('00:10');
        });
    });

    describe('getTileDebuff', () => {
        /** Returns 2 for an ice tile. */
        it('should return 2 for an ice tile', () => {
            expect(service.getTileDebuff([[buildIceTile()]], { x: 0, y: 0 })).toBe(2);
        });

        /** Returns 0 for a non-ice tile. */
        it('should return 0 for a non-ice tile', () => {
            expect(service.getTileDebuff([[buildFloorTile()]], { x: 0, y: 0 })).toBe(0);
        });

        /** Returns 0 for out-of-bounds coordinates. */
        it('should return 0 for out-of-bounds position', () => {
            expect(service.getTileDebuff([[buildFloorTile()]], { x: 99, y: 99 })).toBe(0);
        });
    });

    describe('checkHasAnyAction', () => {
        const baseParams: HasAnyActionParams = {
            isMyTurn: true, actionPoints: 1,
            attackTargets: [], requestFlagTargets: [], giveFlagTargets: [], adjacentDoorTiles: [], sanctuaryTargets: [],
        };

        /** Returns true when there is an attack target available. */
        it('should return true when there is an attack target', () => {
            expect(service.checkHasAnyAction({ ...baseParams, attackTargets: [{ x: 0, y: 0 }] })).toBe(true);
        });

        /** Returns false when it is not the player's turn. */
        it('should return false when it is not my turn', () => {
            expect(service.checkHasAnyAction({ ...baseParams, isMyTurn: false })).toBe(false);
        });

        /** Returns false when action points are zero. */
        it('should return false when action points are zero', () => {
            expect(service.checkHasAnyAction({ ...baseParams, actionPoints: 0, attackTargets: [{ x: 0, y: 0 }] })).toBe(false);
        });

        /** Returns false when all target lists are empty. */
        it('should return false when all target lists are empty', () => {
            expect(service.checkHasAnyAction(baseParams)).toBe(false);
        });
    });

    describe('getDoorActionLabel', () => {
        /** Returns "Ouvrir porte" for a closed door. */
        it('should return "Ouvrir porte" for a closed door', () => {
            expect(service.getDoorActionLabel([{ x: 0, y: 0 }], [[buildDoorClosedTile()]])).toBe('Ouvrir porte');
        });

        /** Returns "Fermer porte" for an opened door. */
        it('should return "Fermer porte" for an opened door', () => {
            expect(service.getDoorActionLabel([{ x: 0, y: 0 }], [[buildDoorOpenedTile()]])).toBe('Fermer porte');
        });

        /** Falls back to "Porte" when no door tiles are given. */
        it('should fall back to "Porte" when doorTiles is empty', () => {
            expect(service.getDoorActionLabel([], build3x3Grid())).toBe('Porte');
        });
    });

    describe('getCurrentPlayerIceDebuff', () => {
        /** Returns 2 when the current player is on ice. */
        it('should return 2 when the current player is on ice', () => {
            expect(service.getCurrentPlayerIceDebuff(SOCKET_A, { [SOCKET_A]: { x: 0, y: 0 } }, () => 2)).toBe(2);
        });

        /** Returns 0 when currentSocketId is undefined. */
        it('should return 0 when currentSocketId is undefined', () => {
            expect(service.getCurrentPlayerIceDebuff(undefined, {}, () => 0)).toBe(0);
        });

        /** Returns 0 when no position is recorded for the player. */
        it('should return 0 when no position is recorded', () => {
            expect(service.getCurrentPlayerIceDebuff(SOCKET_A, {}, () => 2)).toBe(0);
        });
    });

    describe('expandSanctuaryPositions', () => {
        /** Expands a top-left coordinate into a 2×2 sanctuary block producing exactly 4 tiles. */
        it('should expand each top-left position into a 2x2 block', () => {
            const BLOCK_SIZE = 2;
            expect(service.expandSanctuaryPositions([{ x: 0, y: 0 }]).length).toBe(BLOCK_SIZE * BLOCK_SIZE);
        });

        /** Returns an empty array for empty input. */
        it('should return empty array for no input', () => {
            expect(service.expandSanctuaryPositions([])).toEqual([]);
        });
    });

    describe('buildTileClickContext', () => {
        const playerA = buildPlayer(SOCKET_A);
        const playerB = buildPlayer(SOCKET_B);
        const baseLobby = { lobbyId: 'lobby-1', players: [playerA, playerB] } as unknown as Lobby;

        /** Builds a valid context when all fields are present and the tile is highlighted. */
        it('should build context for a valid targeted tile', () => {
            const ctx = service.buildTileClickContext({
                lobby: baseLobby, currentSocketId: SOCKET_A, actionPoints: 1,
                targetSocketId: SOCKET_B, x: 1, y: 0, isHighlighted: true,
            });
            expect(ctx?.currentPlayer.socketId).toBe(SOCKET_A);
        });

        /** Returns null when action points are zero. */
        it('should return null when action points are zero', () => {
            expect(service.buildTileClickContext({
                lobby: baseLobby, currentSocketId: SOCKET_A, actionPoints: 0,
                targetSocketId: SOCKET_B, x: 1, y: 0, isHighlighted: true,
            })).toBeNull();
        });

        /** Returns null when the player targets themselves. */
        it('should return null when targeting oneself', () => {
            expect(service.buildTileClickContext({
                lobby: baseLobby, currentSocketId: SOCKET_A, actionPoints: 1,
                targetSocketId: SOCKET_A, x: 1, y: 0, isHighlighted: true,
            })).toBeNull();
        });
    });

    describe('getAttackTargets', () => {
        /** Returns positions of adjacent enemies while filtering out teammates. */
        it('should return enemy positions only', () => {
            const playerB = buildPlayer(SOCKET_B);
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 0, y: 0 }, [SOCKET_B]: { x: 1, y: 0 } };
            expect(service.getAttackTargets(SOCKET_A, [playerB], positions, []).length).toBe(1);
        });

        /** Returns empty when localId is undefined. */
        it('should return empty when localId is undefined', () => {
            expect(service.getAttackTargets(undefined, [buildPlayer(SOCKET_B)], {}, [])).toEqual([]);
        });

        /** Excludes teammates from attack targets in CTF mode. */
        it('should exclude teammates', () => {
            const playerA = buildPlayer(SOCKET_A);
            const playerB = buildPlayer(SOCKET_B);
            const positions: Record<string, Vec2> = { [SOCKET_A]: { x: 0, y: 0 }, [SOCKET_B]: { x: 1, y: 0 } };
            expect(service.getAttackTargets(SOCKET_A, [playerB], positions, [[playerA, playerB]]).length).toBe(0);
        });
    });
});
