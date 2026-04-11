/**
 * Test suite for the GamePageComponent.
 * This component acts as the main view for the active game session, integrating the board, player list, timer, and chat.
 * The tests heavily mock the GameViewService using writable signals to precisely control and verify the game state and user interactions.
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { GameMode, PlayerType } from '@common/enums';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { GamePageComponent } from './game-page.component';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('GamePageComponent', () => {
    let component: GamePageComponent;
    let fixture: ComponentFixture<GamePageComponent>;
    let router: Router;

    const LOCAL_SOCKET = 'local-socket';
    const OTHER_SOCKET = 'other-socket';


    const DEFAULT_LIFE = 6;
    const BONUS_LIFE = 8;
    const TILE_X = 3;
    const TILE_Y = 5;

    const createPlayer = (socketId: string, overrides: Partial<Player> = {}): Player => {
        const { hasFlag, ...restOverrides } = overrides;

        return {
            socketId,
            isHost: false,
            winsCount: 0,
            hasAbandonned: false,
            playerType: PlayerType.Reel,
            hasFlag: hasFlag ?? false,
            combatCount: 0,
            lossCount: 0,
            totalHpLost: 0,
            totalHpDealt: 0,
            visitedTilesCount: 0,
            character: {
                name: `Player-${socketId}`,
                avatar: 'avatar.png',
                life: DEFAULT_LIFE,
                speed: 4,
                attack: 4,
                defense: 4,
                lifeBonus: false,
                attackDice: 'D6',
                defenseDice: 'D4',
            },
            ...restOverrides,
        };
    };

    const createLobby = (overrides: Partial<Lobby> = {}): Lobby => {
        const { teamA, teamB, ...restOverrides } = overrides;
        return {
            lobbyId: 'lobby-1',
            gameId: 'game-1',
            hostSocketId: LOCAL_SOCKET,
            playerCount: 2,
            isLocked: true,
            players: [createPlayer(LOCAL_SOCKET, { isHost: true }), createPlayer(OTHER_SOCKET)],
            game: {
                _id: 'game-1',
                name: 'Test Game',
                description: '',
                size: { rows: 10, cols: 10 },
                gameMode: GameMode.Classic,
                thumbnail: '',
                maxPlayers: 4,
                grid: [],
                isVisible: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            pendingAvatars: {},
            chatHistory: [],
            ...restOverrides,
            teamA: teamA ?? [],
            teamB: teamB ?? [],
        };
    };

    const mockGameViewService = {
        gameLobby: signal<Lobby | null>(null),
        playerPositions: signal<Record<string, { x: number; y: number }>>({}),
        turnOrder: signal<string[]>([]),
        activePlayerSocketId: signal<string | null>(null),
        turnCountdown: signal<number>(0),
        reachableTiles: signal<{ x: number; y: number }[]>([]),
        reachableTilesForTeleport: signal<{ x: number; y: number }[]>([]),
        movementPoints: signal<number>(0),
        actionPoints: signal<number>(0),
        disableEndTurn: signal<boolean>(false),
        isDebugModeActive: signal<boolean>(false),
        tileInfo: signal<unknown>(null),
        gameOver: signal<{ winnerSocketId: string | null; isForfeit?: boolean } | null>(null),
        inactiveSanctuaries: signal<{ x: number; y: number }[]>([]),
        journalEntries: signal<string[]>([]),
        combatLockState: signal<{ isLocked: boolean; attackerSocketId?: string; defenderSocketId?: string } | null>(null),
        isCombatStarted: signal<boolean>(false),
        fighters: signal({ player: {} as Player, enemy: {} as Player, roomId: '' }),
        getLocalSocketId: jasmine.createSpy('getLocalSocketId').and.returnValue(LOCAL_SOCKET),
        isHost: jasmine.createSpy('isHost').and.returnValue(false),
        sendMove: jasmine.createSpy('sendMove'),
        sendEndTurn: jasmine.createSpy('sendEndTurn'),
        sendAbandon: jasmine.createSpy('sendAbandon'),
        sendAbandonWithoutPrompt: jasmine.createSpy('sendAbandonWithoutPrompt'),
        sendCombat: jasmine.createSpy('sendCombat'),
        sendTileInfoRequest: jasmine.createSpy('sendTileInfoRequest'),
        sendToggleDoor: jasmine.createSpy('sendToggleDoor'),
        sendUseSanctuary: jasmine.createSpy('sendUseSanctuary'),
        toggleDebugMode: jasmine.createSpy('toggleDebugMode'),
        teleportMove: jasmine.createSpy('teleportMove'),
        setLobby: jasmine.createSpy('setLobby'),
        resetGameState: jasmine.createSpy('resetGameState'),
    };

    const resetMockSignals = () => {
        mockGameViewService.gameLobby.set(null);
        mockGameViewService.playerPositions.set({});
        mockGameViewService.turnOrder.set([]);
        mockGameViewService.activePlayerSocketId.set(null);
        mockGameViewService.turnCountdown.set(0);
        mockGameViewService.reachableTiles.set([]);
        mockGameViewService.reachableTilesForTeleport.set([]);
        mockGameViewService.movementPoints.set(0);
        mockGameViewService.actionPoints.set(0);
        mockGameViewService.disableEndTurn.set(false);
        mockGameViewService.isDebugModeActive.set(false);
        mockGameViewService.tileInfo.set(null);
        mockGameViewService.gameOver.set(null);
        mockGameViewService.inactiveSanctuaries.set([]);
        mockGameViewService.journalEntries.set([]);
        mockGameViewService.combatLockState.set(null);
        mockGameViewService.isCombatStarted.set(false);
        mockGameViewService.fighters.set({ player: {} as Player, enemy: {} as Player, roomId: '' });
        [mockGameViewService.sendMove, mockGameViewService.sendEndTurn,
         mockGameViewService.sendAbandon, mockGameViewService.sendAbandonWithoutPrompt,
         mockGameViewService.sendCombat, mockGameViewService.sendTileInfoRequest,
         mockGameViewService.sendToggleDoor, mockGameViewService.sendUseSanctuary,
         mockGameViewService.toggleDebugMode, mockGameViewService.teleportMove,
         mockGameViewService.isHost].forEach((s) => s.calls.reset());
    };

    beforeEach(async () => {
        resetMockSignals();
        await TestBed.configureTestingModule({
            imports: [GamePageComponent],
            providers: [
                provideRouter([{ path: 'home', component: DummyComponent }]),
                { provide: GameViewService, useValue: mockGameViewService },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
    });

    /** Ensures the component successfully instantiates without throwing any errors. */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        /** Protects the game view by immediately redirecting users back to the homepage if they attempt to access the route without an active lobby loaded. */
        it('should redirect to home when no lobby is loaded', () => {
            spyOn(router, 'navigate');
            component.ngOnInit();
            expect(router.navigate).toHaveBeenCalledWith(['/home']);
        });

        /** Allows the component to initialize normally and remain on the page when valid lobby data is detected in the service. */
        it('should stay on the page when a lobby exists', () => {
            spyOn(router, 'navigate');
            mockGameViewService.gameLobby.set(createLobby());
            component.ngOnInit();
            expect(router.navigate).not.toHaveBeenCalled();
        });
    });

    describe('isMyTurn', () => {
        /** Confirms the turn indicator activates dynamically when the local player's socket ID matches the currently active player's ID. */
        it('should be true when the active player is me', () => {
            mockGameViewService.activePlayerSocketId.set(LOCAL_SOCKET);
            expect(component.isMyTurn()).toBe(true);
        });

        /** Ensures the local player's turn indicator remains deactivated while an opponent is currently taking their turn. */
        it('should be false when it is someone else turn', () => {
            mockGameViewService.activePlayerSocketId.set(OTHER_SOCKET);
            expect(component.isMyTurn()).toBe(false);
        });

        /** Verifies that no player is flagged as active during the brief transitional delay between two separate turns. */
        it('should be false between turns (no active player)', () => {
            mockGameViewService.activePlayerSocketId.set(null);
            expect(component.isMyTurn()).toBe(false);
        });
    });

    describe('localPlayer', () => {
        /** Successfully isolates and retrieves the local player's specific character data from the general lobby player list. */
        it('should find the player matching our socket ID', () => {
            mockGameViewService.gameLobby.set(createLobby());
            expect(component.localPlayer()?.socketId).toBe(LOCAL_SOCKET);
        });

        /** Gracefully handles the absence of lobby data by returning undefined rather than throwing a read error. */
        it('should be undefined when the lobby is not set', () => {
            expect(component.localPlayer()).toBeUndefined();
        });
    });

    describe('maxLife', () => {
        /** Validates that standard player characters accurately reflect the default maximum health pool. */
        it('should be DEFAULT_LIFE for a regular player (no life bonus)', () => {
            mockGameViewService.gameLobby.set(createLobby());
            expect(component.maxLife()).toBe(DEFAULT_LIFE);
        });

        /** Ensures that players who selected the specific life bonus trait during character creation correctly receive a higher maximum health pool. */
        it('should be BONUS_LIFE for a player with the life bonus', () => {
            const lobby = createLobby({
                players: [
                    createPlayer(LOCAL_SOCKET, {
                        isHost: true,
                        character: {
                            name: 'Tank', avatar: '', life: BONUS_LIFE, speed: 4,
                            attack: 4, defense: 4, lifeBonus: true, attackDice: 'D6', defenseDice: 'D4',
                        },
                    }),
                    createPlayer(OTHER_SOCKET),
                ],
            });
            mockGameViewService.gameLobby.set(lobby);
            expect(component.maxLife()).toBe(BONUS_LIFE);
        });
    });

    describe('orderedPlayers', () => {
        /** Confirms that the player roster is correctly ordered based on the server-provided turn sequence. */
        it('should return players in the turn order', () => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.turnOrder.set([OTHER_SOCKET, LOCAL_SOCKET]);
            expect(component.orderedPlayers()[0].socketId).toBe(OTHER_SOCKET);
        });

        /** Verifies that the UI list dynamically rotates so that the player whose turn it currently is always appears at the top of the display. */
        it('should rotate so the active player is at the top', () => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.turnOrder.set([LOCAL_SOCKET, OTHER_SOCKET]);
            mockGameViewService.activePlayerSocketId.set(OTHER_SOCKET);
            expect(component.orderedPlayers()[0].socketId).toBe(OTHER_SOCKET);
        });
    });

    describe('adjacentPlayers', () => {
        /** Accurately identifies valid combat targets by locating opponents standing directly up, down, left, or right of the active player. */
        it('should find players on cardinal neighbors when it is my turn', () => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.activePlayerSocketId.set(LOCAL_SOCKET);
            mockGameViewService.playerPositions.set({ [LOCAL_SOCKET]: { x: 2, y: 2 }, [OTHER_SOCKET]: { x: 3, y: 2 } });
            expect(component.adjacentPlayers().length).toBe(1);
            expect(component.adjacentPlayers()[0].socketId).toBe(OTHER_SOCKET);
        });

        /** Prevents initiating out-of-sequence combat actions by returning an empty list of targets if it is not the local player's turn. */
        it('should be empty when it is not my turn', () => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.activePlayerSocketId.set(OTHER_SOCKET);
            mockGameViewService.playerPositions.set({ [LOCAL_SOCKET]: { x: 2, y: 2 }, [OTHER_SOCKET]: { x: 3, y: 2 } });
            expect(component.adjacentPlayers()).toEqual([]);
        });

        /** Strictly enforces grid combat rules by completely ignoring opponents placed on diagonal tiles. */
        it('should not include diagonal neighbors', () => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.activePlayerSocketId.set(LOCAL_SOCKET);
            mockGameViewService.playerPositions.set({ [LOCAL_SOCKET]: { x: 2, y: 2 }, [OTHER_SOCKET]: { x: 3, y: 3 } });
            expect(component.adjacentPlayers()).toEqual([]);
        });

        /** Ensures that players who have already quit the session are completely ignored and cannot be targeted for combat. */
        it('should exclude players who abandoned', () => {
            const lobby = createLobby({
                players: [createPlayer(LOCAL_SOCKET, { isHost: true }), createPlayer(OTHER_SOCKET, { hasAbandonned: true })],
            });
            mockGameViewService.gameLobby.set(lobby);
            mockGameViewService.activePlayerSocketId.set(LOCAL_SOCKET);
            mockGameViewService.playerPositions.set({ [LOCAL_SOCKET]: { x: 2, y: 2 }, [OTHER_SOCKET]: { x: 3, y: 2 } });
            expect(component.adjacentPlayers()).toEqual([]);
        });
    });

    describe('onKeyUp', () => {
        beforeEach(() => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.activePlayerSocketId.set(LOCAL_SOCKET);
        });

        /** Maps the standard WASD keyboard inputs directly to their corresponding directional movement payloads sent to the server. */
        [{ key: 'w', dir: 'W' }, { key: 'a', dir: 'A' }, { key: 's', dir: 'S' }, { key: 'd', dir: 'D' }].forEach(({ key, dir }) => {
            it(`should send "${dir}" when pressing "${key}"`, () => {
                component.onKeyUp(new KeyboardEvent('keyup', { key }));
                expect(mockGameViewService.sendMove).toHaveBeenCalledWith('lobby-1', dir);
            });
        });

        /** Acts as a necessary UI guard to prevent accidental character movement on the board while the player is actively typing in the chat box. */
        it('should NOT move when the chat input is focused', () => {
            component.isChatFocused = true;
            component.onKeyUp(new KeyboardEvent('keyup', { key: 'w' }));
            expect(mockGameViewService.sendMove).not.toHaveBeenCalled();
        });

        /** Prevents the local player from sending unauthorized movement commands to the server while an opponent is playing their turn. */
        it('should NOT move when it is not my turn', () => {
            mockGameViewService.activePlayerSocketId.set(OTHER_SOCKET);
            component.onKeyUp(new KeyboardEvent('keyup', { key: 'w' }));
            expect(mockGameViewService.sendMove).not.toHaveBeenCalled();
        });

        /** Ensures that arbitrary keystrokes outside of the designated WASD control scheme do not trigger any unintended game events. */
        it('should ignore keys that are not WASD', () => {
            component.onKeyUp(new KeyboardEvent('keyup', { key: 'x' }));
            expect(mockGameViewService.sendMove).not.toHaveBeenCalled();
        });
    });

    describe('onTileClick (combat)', () => {
        /** Ensures the combat initiation action successfully dispatches the request to the server, targeting the precise opponent selected. */
        it('should send the combat request with the target socket when clicking an adjacent player tile', () => {
            mockGameViewService.gameLobby.set(createLobby());
            mockGameViewService.activePlayerSocketId.set(LOCAL_SOCKET);
            mockGameViewService.playerPositions.set({
                [LOCAL_SOCKET]: { x: 0, y: 0 },
                [OTHER_SOCKET]: { x: 1, y: 0 },
            });
            mockGameViewService.actionPoints.set(1);
            component.isSubMenuOpen.set(true);
            component.activeSubAction.set('attack');
            spyOn(component, 'isOnIce').and.returnValue(0);
            component.onTileClick(1, 0);
            expect(mockGameViewService.sendCombat).toHaveBeenCalledWith(
                'lobby-1',
                jasmine.objectContaining({ socketId: LOCAL_SOCKET }),
                jasmine.objectContaining({ socketId: OTHER_SOCKET }),
            );
        });
    });

    describe('onRightClick', () => {
        /** Blocks the default browser context menu from appearing and instead leverages the right-click action to request detailed tile information from the server. */
        it('should prevent the context menu and request tile info', () => {
            mockGameViewService.gameLobby.set(createLobby());
            const event = new MouseEvent('contextmenu');
            spyOn(event, 'preventDefault');
            component.onRightClick(event, { x: TILE_X, y: TILE_Y });
            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockGameViewService.sendTileInfoRequest).toHaveBeenCalledWith('lobby-1', { x: TILE_X, y: TILE_Y });
        });
    });

    describe('onChatFocusChange', () => {
        /** Accurately tracks the focus state of the chat component, allowing the main game view to conditionally disable keyboard shortcuts. */
        it('should track whether the chat input is focused', () => {
            component.onChatFocusChange(true);
            expect(component.isChatFocused).toBe(true);
            component.onChatFocusChange(false);
            expect(component.isChatFocused).toBe(false);
        });
    });

    describe('isReachable', () => {
        /** Evaluates to true when the requested tile coordinates are present within the server-validated set of reachable positions. */
        it('should return true for tiles in the reachable set', () => {
            mockGameViewService.reachableTiles.set([{ x: TILE_X, y: 2 }]);
            expect(component.isReachable(TILE_X, 2)).toBe(true);
        });

        /** Evaluates to false when checking a tile that is outside the character's current movement capabilities. */
        it('should return false for tiles not in the set', () => {
            mockGameViewService.reachableTiles.set([{ x: TILE_X, y: 2 }]);
            expect(component.isReachable(0, 0)).toBe(false);
        });
    });

    describe('getPlayerAtPosition', () => {
        /** Correctly identifies and returns the unique socket ID of the player currently occupying the specified coordinates. */
        it('should return the socket ID of whoever is standing there', () => {
            mockGameViewService.playerPositions.set({ [LOCAL_SOCKET]: { x: 2, y: TILE_X } });
            expect(component.getPlayerAtPosition(2, TILE_X)).toBe(LOCAL_SOCKET);
        });

        /** Returns a null value gracefully when querying a set of coordinates that currently contain no player. */
        it('should return null for an empty tile', () => {
            mockGameViewService.playerPositions.set({ [LOCAL_SOCKET]: { x: 2, y: TILE_X } });
            expect(component.getPlayerAtPosition(0, 0)).toBeNull();
        });
    });

    describe('getPlayerName', () => {
        /** Retrieves the custom character name associated with a specific socket ID from the lobby data. */
        it('should return the character name', () => {
            mockGameViewService.gameLobby.set(createLobby());
            expect(component.getPlayerName(LOCAL_SOCKET)).toBe(`Player-${LOCAL_SOCKET}`);
        });

        /** Provides a clean fallback label ("Un joueur") to prevent rendering errors if a socket ID cannot be matched to a known player profile. */
        it('should fall back to "Un joueur" for unknown sockets', () => {
            mockGameViewService.gameLobby.set(createLobby());
            expect(component.getPlayerName('ghost')).toBe('Un joueur');
        });
    });
});