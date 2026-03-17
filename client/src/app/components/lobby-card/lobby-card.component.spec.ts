/**
 * Test suite for the LobbyCardComponent.
 * This is a pure presentation component designed to display a unified snapshot of a game session based on an injected Lobby object.
 * The tests heavily validate template rendering logic, ensuring game names, grid sizes, modes, and player capacities are displayed correctly.
 * Additionally, it verifies that content projection via <ng-content> successfully renders external action buttons inside the card framework.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMode } from '@common/enums';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { LobbyCardComponent } from './lobby-card.component';

// Host component for testing <ng-content> projection.
@Component({
    template: `<app-lobby-card [lobby]="lobby"><button class="projected-btn">Join</button></app-lobby-card>`,
    imports: [LobbyCardComponent],
})
class TestHostComponent {
    lobby!: Lobby;
}

describe('LobbyCardComponent', () => {
    let component: LobbyCardComponent;
    let fixture: ComponentFixture<LobbyCardComponent>;

    const SMALL_MAX = 2;
    const MEDIUM_MAX = 4;
    const LARGE_MAX = 6;
    const EXPECTED_LIST_ITEMS = 4;

    const createMockGame = (overrides: Partial<Game> = {}): Game => ({
        _id: 'game-1', name: 'Test Game', description: 'A test game', size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic, thumbnail: 'thumb.png', maxPlayers: MEDIUM_MAX, grid: [],
        createdAt: new Date(), updatedAt: new Date(), isVisible: true, ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'ABCDE', gameId: 'game-1', hostSocketId: 'socket-1', playerCount: 1,
        isLocked: false, pendingAvatars: {}, players: [], game: createMockGame(),
        chatHistory: [], ...overrides,
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({ 
            imports: [LobbyCardComponent], 
        }).compileComponents();
        fixture = TestBed.createComponent(LobbyCardComponent);
        component = fixture.componentInstance;
    });

    /** Ensures the component successfully instantiates without throwing any errors when provided with valid lobby data. */
    it('should create', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    /** Confirms that the component successfully binds and exposes the injected lobby data for use within the template. */
    it('should have the lobby input bound', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component.lobby.lobbyId).toBe('ABCDE');
    });

    /** Verifies that the internal GameMode enum is properly exposed to the template for logical comparisons. */
    it('should expose the GameMode enum for the template', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component.gameMode).toBe(GameMode);
    });

    /** Ensures the specified title of the game is accurately extracted and rendered in the DOM. */
    it('should show the game name', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Test Game');
    });

    /** Validates that grid dimensions are cleanly formatted into a standard "NxN" string for quick visual scanning. */
    it('should show the grid size in NxN format', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('10X10');
    });

    /** Formats the lobby occupancy dynamically, displaying the current player count against the hard limit. */
    it('should show player count as current/max', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('1/4');
    });

    /** Confirms that the designated image source string is successfully bound to the thumbnail image element. */
    it('should show the thumbnail image', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.src).toContain('thumb.png');
    });

    /** Enhances accessibility by dynamically injecting the game's title as the alt-text attribute for the thumbnail image. */
    it('should use the game name as the thumbnail alt text', () => {
        component.lobby = createMockLobby({ game: createMockGame({ name: 'Aventure Spatiale' }) });
        fixture.detectChanges();
        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.alt).toBe('Aventure Spatiale');
    });

    /** Parametrized test that rigorously verifies the accurate translation of internal GameMode enums into human-readable UI labels. */
    [{ mode: GameMode.Classic, label: 'Classique' }, { mode: GameMode.Ctf, label: 'CTF' }].forEach(({ mode, label }) => {
        it(`should display "${label}" for ${mode} mode`, () => {
            component.lobby = createMockLobby({ game: createMockGame({ gameMode: mode }) });
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain(label);
        });
    });

    /** Parametrized test ensuring that all three standard grid board dimensions are parsed and rendered correctly. */
    [{ r: 10, c: 10, s: '10X10' }, { r: 15, c: 15, s: '15X15' }, { r: 20, c: 20, s: '20X20' }].forEach(({ r, c, s }) => {
        it(`should display "${s}" for a ${r}x${c} grid`, () => {
            component.lobby = createMockLobby({ game: createMockGame({ size: { rows: r, cols: c } }) });
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain(s);
        });
    });

    /** Validates that the occupancy indicator accurately reflects completely filled lobbies across different size configurations. */
    [{ max: SMALL_MAX, label: 'small' }, { max: MEDIUM_MAX, label: 'medium' }, { max: LARGE_MAX, label: 'large' }].forEach(({ max, label }) => {
        it(`should show "${max}/${max}" when a ${label} lobby is full`, () => {
            component.lobby = createMockLobby({ playerCount: max, game: createMockGame({ maxPlayers: max }) });
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain(`${max}/${max}`);
        });
    });

    /** Ensures the component correctly formats the minimum possible occupancy state (a single host in a newly created lobby). */
    it('should show "1/N" for a single-player lobby', () => {
        component.lobby = createMockLobby({ playerCount: 1, game: createMockGame({ maxPlayers: LARGE_MAX }) });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(`1/${LARGE_MAX}`);
    });

    /** Proves the component remains strictly reactive to its inputs, updating entirely when swapped with fresh data rather than caching. */
    it('should update when the lobby input changes', () => {
        component.lobby = createMockLobby({ 
            game: createMockGame({ name: 'New Game', size: { rows: 20, cols: 20 }, gameMode: GameMode.Ctf }), 
            playerCount: 3,
        });
        fixture.detectChanges();
        const text = (fixture.nativeElement as HTMLElement).textContent;
        expect(text).toContain('New Game');
        expect(text).toContain('20X20');
        expect(text).toContain('CTF');
    });

    /** Verifies that the CSS and template structures are robust enough to display exceptionally long game names without crashing. */
    it('should render a very long game name without truncation', () => {
        const longName = 'Un Nom De Jeu Très Long Pour Tester Les Limites';
        component.lobby = createMockLobby({ game: createMockGame({ name: longName }) });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(longName);
    });

    /** Confirms the thumbnail element can dynamically bind to longer, directory-based image path formats. */
    it('should reflect a different thumbnail URL', () => {
        component.lobby = createMockLobby({ game: createMockGame({ thumbnail: 'assets/images/map-preview.jpg' }) });
        fixture.detectChanges();
        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.src).toContain('assets/images/map-preview.jpg');
    });

    /** A comprehensive integration check ensuring all customized data fields render perfectly together in a single cohesive CTF lobby card. */
    it('should render all fields correctly for a CTF lobby', () => {
        component.lobby = createMockLobby({ 
            playerCount: 2, 
            game: createMockGame({ 
                name: 'Capture The Flag', size: { rows: 15, cols: 15 }, 
                gameMode: GameMode.Ctf, maxPlayers: MEDIUM_MAX, thumbnail: 'ctf.png',
            }),
        });
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('Capture The Flag');
        expect(el.textContent).toContain('15X15');
        expect(el.textContent).toContain('CTF');
        expect(el.textContent).toContain(`2/${MEDIUM_MAX}`);
        expect((el.querySelector('img.thumbnail') as HTMLImageElement).src).toContain('ctf.png');
    });

    /** Verifies the foundational outer structural wrapper of the card is present in the DOM for styling purposes. */
    it('should render the .lobbyCard container', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelector('.lobbyCard')).toBeTruthy();
    });

    /** Confirms the layout structure by counting the exact number of list items containing the game's core metadata. */
    it('should have four list items in the info section', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(EXPECTED_LIST_ITEMS);
    });
});

describe('LobbyCardComponent (content projection)', () => {
    const DEFAULT_MAX_PLAYERS = 4;
    
    const createMockLobby = (): Lobby => ({
        lobbyId: 'ABCDE', gameId: 'game-1', hostSocketId: 'socket-1', playerCount: 1,
        isLocked: false, pendingAvatars: {}, players: [],
        game: { 
            _id: 'game-1', name: 'Test', description: '', size: { rows: 10, cols: 10 }, 
            gameMode: GameMode.Classic, thumbnail: 'thumb.png', maxPlayers: DEFAULT_MAX_PLAYERS, 
            grid: [], createdAt: new Date(), updatedAt: new Date(), isVisible: true,
        },
        chatHistory: [],
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    });

    /** Confirms that external interactive elements passed via content projection are successfully integrated. */
    it('should render projected content in the button slot', () => {
        const hostFixture = TestBed.createComponent(TestHostComponent);
        hostFixture.componentInstance.lobby = createMockLobby();
        hostFixture.detectChanges();
        const btn = (hostFixture.nativeElement as HTMLElement).querySelector('.projected-btn');
        expect(btn).toBeTruthy();
        expect(btn?.textContent).toBe('Join');
    });
});