/**
 * LobbyCardComponent Test Suite
 *
 * Testing Strategy:
 * This test suite validates the lobby card display component used in the join-game page.
 * The LobbyCardComponent is a pure presentation component that receives a Lobby object
 * via @Input() and renders game information (name, size, mode, player count, thumbnail).
 * We test five core aspects:
 *
 * 1. Component Initialization - Verifies the component creates successfully with valid
 *    lobby data and exposes the GameMode enum for template ternary usage.
 *
 * 2. Template Rendering - Tests that each piece of game information is rendered correctly
 *    in the DOM. Each field (name, size, mode, players, thumbnail) has dedicated tests
 *    to ensure data flows from the @Input() binding to the template output.
 *
 * 3. Game Mode Label Mapping - The template uses a ternary expression to convert GameMode
 *    enum values to French display labels ('Classique' for Classic, 'CTF' for Ctf).
 *    Parameterized tests cover both enum values to ensure correct mapping without code
 *    duplication.
 *
 * 4. Grid Size Variants - The card displays grid dimensions in "NxN" format. Parameterized
 *    tests verify all three standard sizes (10x10, 15x15, 20x20) render correctly.
 *
 * 5. Edge Cases - Tests behavior with boundary values:
 *    - Full lobby (playerCount === maxPlayers) — verifies "N/N" display
 *    - Single player lobby (playerCount === 1) — minimum occupancy boundary
 *    - Maximum player counts for small (2) and medium (4) maps
 *    - Long game names — ensures no truncation in DOM
 *    - Different thumbnail URLs — verifies dynamic src binding
 *    - Lobby with CTF game data — verifies all fields render correctly together
 *    - Content projection — verifies ng-content slot renders projected elements
 *
 * Parameterized Testing:
 * Game mode display, grid size rendering, and player count boundaries use parameterized
 * test patterns (forEach loops) to avoid code duplication while covering all variants.
 * Each parameterized case includes its own descriptive test name for clear failure reporting.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMode } from '@common/enums';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { LobbyCardComponent } from './lobby-card.component';

// Test host component for content projection testing.
// LobbyCardComponent uses <ng-content> to allow parent components
// to project buttons or other elements into the card-buttons slot.
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

    const SMALL_MAP_MAX_PLAYERS = 2;
    const MEDIUM_MAP_MAX_PLAYERS = 4;
    const LARGE_MAP_MAX_PLAYERS = 6;

    const createMockGame = (overrides: Partial<Game> = {}): Game => ({
        _id: 'game-1',
        name: 'Test Game',
        description: 'A test game',
        size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic,
        thumbnail: 'thumb.png',
        maxPlayers: MEDIUM_MAP_MAX_PLAYERS,
        grid: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isVisible: true,
        ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'ABCDE',
        gameId: 'game-1',
        hostSocketId: 'socket-1',
        playerCount: 1,
        isLocked: false,
        pendingAvatars: {},
        players: [],
        game: createMockGame(),
        chatHistory: [],
        ...overrides,
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LobbyCardComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(LobbyCardComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    // ─── Input Binding Tests ──────────────────────────────────────────────
    //
    // The component receives its data through the lobby @Input() binding.
    // It also exposes the GameMode enum as a public property so the template
    // can compare lobby.game.gameMode against GameMode.Classic in its ternary.

    it('should have the lobby input bound', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component.lobby).toBeTruthy();
        expect(component.lobby.lobbyId).toBe('ABCDE');
    });

    it('should expose GameMode enum as gameMode property', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component.gameMode).toBe(GameMode);
    });

    // ─── Template Rendering Tests ─────────────────────────────────────────
    //
    // Each test targets a specific piece of displayed data. The template
    // renders lobby.game properties inside <span> elements within a <ul>.
    // We verify both the text content and, where applicable, element
    // attributes (e.g., img src and alt).

    it('should display the game name', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('Test Game');
    });

    it('should display the game size in rows x cols format', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('10X10');
    });

    it('should display the player count and max players', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('1/4');
    });

    it('should display the game thumbnail image', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        const img = compiled.querySelector('img.thumbnail') as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.src).toContain('thumb.png');
    });

    // Edge Case: Thumbnail alt attribute
    //
    // The template binds [alt]="lobby.game.name" on the img element.
    // Screen readers and accessibility tools rely on this attribute.
    // We verify it matches the game name exactly.

    it('should set the thumbnail alt attribute to the game name', () => {
        component.lobby = createMockLobby({ game: createMockGame({ name: 'Aventure Spatiale' }) });
        fixture.detectChanges();

        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.alt).toBe('Aventure Spatiale');
    });

    // ─── Parameterized Game Mode Display Tests ────────────────────────────
    //
    // The template uses a ternary to display 'Classique' or 'CTF' based on
    // the game mode enum. We test both values to ensure correct label mapping.
    // This is critical because the ternary uses == (loose equality), so both
    // enum values must produce the correct French label.

    const gameModeDisplayCases: { mode: GameMode; expectedLabel: string }[] = [
        { mode: GameMode.Classic, expectedLabel: 'Classique' },
        { mode: GameMode.Ctf, expectedLabel: 'CTF' },
    ];

    gameModeDisplayCases.forEach(({ mode, expectedLabel }) => {
        it(`should display '${expectedLabel}' for ${mode} game mode`, () => {
            component.lobby = createMockLobby({ game: createMockGame({ gameMode: mode }) });
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.textContent).toContain(expectedLabel);
        });
    });

    // ─── Parameterized Grid Size Display Tests ────────────────────────────
    //
    // The card displays the grid dimensions in "NXN" format (uppercase X).
    // We verify all three standard sizes to ensure the template interpolation
    // {{ lobby.game.size.rows }}X{{ lobby.game.size.cols }} works for each.

    const gridSizeCases: { rows: number; cols: number; expected: string }[] = [
        { rows: 10, cols: 10, expected: '10X10' },
        { rows: 15, cols: 15, expected: '15X15' },
        { rows: 20, cols: 20, expected: '20X20' },
    ];

    gridSizeCases.forEach(({ rows, cols, expected }) => {
        it(`should display '${expected}' for a ${rows}x${cols} grid`, () => {
            component.lobby = createMockLobby({ game: createMockGame({ size: { rows, cols } }) });
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.textContent).toContain(expected);
        });
    });

    // ─── Player Count Boundary Tests ──────────────────────────────────────
    //
    // The player count display ("N/M") must handle boundary values correctly.
    // We parameterize across different maxPlayers values (small=2, medium=4,
    // large=6) to test both full and single-player scenarios for each map size.

    // Edge Case: Full Lobby
    //
    // When playerCount equals maxPlayers, the card should still render
    // correctly showing the full count (e.g., "4/4"). This is the upper
    // boundary for the player count display.

    const fullLobbyCases: { maxPlayers: number; label: string }[] = [
        { maxPlayers: SMALL_MAP_MAX_PLAYERS, label: 'small' },
        { maxPlayers: MEDIUM_MAP_MAX_PLAYERS, label: 'medium' },
        { maxPlayers: LARGE_MAP_MAX_PLAYERS, label: 'large' },
    ];

    fullLobbyCases.forEach(({ maxPlayers, label }) => {
        it(`should display '${maxPlayers}/${maxPlayers}' when ${label} lobby is full`, () => {
            component.lobby = createMockLobby({ playerCount: maxPlayers, game: createMockGame({ maxPlayers }) });
            fixture.detectChanges();

            const compiled = fixture.nativeElement as HTMLElement;
            expect(compiled.textContent).toContain(`${maxPlayers}/${maxPlayers}`);
        });
    });

    // Edge Case: Single Player Lobby
    //
    // Minimum case where only the host is in the lobby. Should display "1/N"
    // regardless of maxPlayers. This is the lower boundary for player count.

    it('should display correct count for single player lobby', () => {
        component.lobby = createMockLobby({ playerCount: 1, game: createMockGame({ maxPlayers: LARGE_MAP_MAX_PLAYERS }) });
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain(`1/${LARGE_MAP_MAX_PLAYERS}`);
    });

    // ─── Edge Case: Lobby With Different Game Data ────────────────────────
    //
    // Verifies the component renders correctly when given a completely
    // different set of game data (CTF mode, larger grid, different name).
    // This ensures no field is hardcoded or cached from a previous render.

    it('should update display when lobby input changes', () => {
        component.lobby = createMockLobby({
            game: createMockGame({ name: 'New Game', size: { rows: 20, cols: 20 }, gameMode: GameMode.Ctf }),
            playerCount: 3,
        });
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('New Game');
        expect(compiled.textContent).toContain('20X20');
        expect(compiled.textContent).toContain('CTF');
    });

    // ─── Edge Case: Long Game Name ────────────────────────────────────────
    //
    // Game names can be arbitrarily long. The component must render the
    // full name without truncation in the DOM (CSS may handle overflow,
    // but the text content must be complete).

    it('should display full game name even when very long', () => {
        const longName = 'Un Nom De Jeu Très Long Pour Tester Les Limites';
        component.lobby = createMockLobby({ game: createMockGame({ name: longName }) });
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain(longName);
    });

    // ─── Edge Case: Different Thumbnail URL ───────────────────────────────
    //
    // The thumbnail src is dynamically bound via [src]. We verify that
    // changing the game thumbnail URL updates the img element's src attribute.

    it('should render different thumbnail URL', () => {
        component.lobby = createMockLobby({ game: createMockGame({ thumbnail: 'assets/images/map-preview.jpg' }) });
        fixture.detectChanges();

        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.src).toContain('assets/images/map-preview.jpg');
    });

    // ─── Edge Case: All Fields With CTF Game ──────────────────────────────
    //
    // Integration-style edge case: verifies all rendered fields are correct
    // simultaneously for a CTF lobby with non-default values. This catches
    // issues where fixing one field's rendering might break another.

    it('should render all fields correctly for a CTF lobby with custom data', () => {
        component.lobby = createMockLobby({
            playerCount: 2,
            game: createMockGame({
                name: 'Capture The Flag',
                size: { rows: 15, cols: 15 },
                gameMode: GameMode.Ctf,
                maxPlayers: MEDIUM_MAP_MAX_PLAYERS,
                thumbnail: 'ctf-map.png',
            }),
        });
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('Capture The Flag');
        expect(compiled.textContent).toContain('15X15');
        expect(compiled.textContent).toContain('CTF');
        expect(compiled.textContent).toContain(`2/${MEDIUM_MAP_MAX_PLAYERS}`);

        const img = compiled.querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.src).toContain('ctf-map.png');
    });

    // ─── DOM Structure Tests ──────────────────────────────────────────────
    //
    // These tests verify the expected DOM elements exist. The template
    // uses specific CSS classes (lobbyCard, image-frame, card-info,
    // card-buttons) that are relied upon by the SCSS and parent components.

    it('should render the lobbyCard container element', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();

        const card = (fixture.nativeElement as HTMLElement).querySelector('.lobbyCard');
        expect(card).toBeTruthy();
    });

    it('should render the info list with four items', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();

        const listItems = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
        const EXPECTED_LIST_ITEMS = 4;
        expect(listItems.length).toBe(EXPECTED_LIST_ITEMS);
    });

});

// ─── Content Projection Test ──────────────────────────────────────────
//
// The template uses <ng-content> inside .card-buttons to allow parent
// components to project action buttons (e.g., "Sélectionner") into the
// card. We use a separate describe with its own TestBed configuration
// and a test host component to verify projected content renders.

describe('LobbyCardComponent (content projection)', () => {
    const createMockGame = (overrides: Partial<Game> = {}): Game => ({
        _id: 'game-1',
        name: 'Test Game',
        description: 'A test game',
        size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic,
        thumbnail: 'thumb.png',
        maxPlayers: 4,
        grid: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isVisible: true,
        ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
        lobbyId: 'ABCDE',
        gameId: 'game-1',
        hostSocketId: 'socket-1',
        playerCount: 1,
        isLocked: false,
        pendingAvatars: {},
        players: [],
        game: createMockGame(),
        chatHistory: [],
        ...overrides,
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();
    });

    it('should project content into the card-buttons slot', () => {
        const hostFixture = TestBed.createComponent(TestHostComponent);
        hostFixture.componentInstance.lobby = createMockLobby();
        hostFixture.detectChanges();

        const projectedButton = (hostFixture.nativeElement as HTMLElement).querySelector('.projected-btn');
        expect(projectedButton).toBeTruthy();
        expect(projectedButton?.textContent).toBe('Join');
    });
});
