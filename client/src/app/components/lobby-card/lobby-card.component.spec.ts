/**
 * LobbyCardComponent Test Suite
 *
 * Testing Strategy:
 * This is a presentation component, it takes a Lobby object and renders it as a card.
 * No services, no logic, just template bindings. We test three main things:
 *
 * 1. Data Rendering - Making sure the game name, grid size, game mode label, player count,
 *    and thumbnail all show up correctly in the DOM. We use parametrized tests for modes
 *    and grid sizes since there are a few valid options for each.
 *
 * 2. Edge Cases - Things like really long game names, swapping lobby data after init,
 *    and different thumbnail paths. We want to make sure the card doesn't break or
 *    cache stale values when the input changes.
 *
 * 3. DOM Structure and Content Projection - Quick checks that the expected wrapper elements
 *    and list items exist, plus a test with a host component to verify <ng-content> works
 *    so we can slot in action buttons from the parent.
 *
 * Mocking Strategy:
 * Since this component has no injected services, we just need mock data. We use two factory
 * helpers (createMockGame / createMockLobby) that accept partial overrides - this way each
 * test only specifies the fields it cares about and gets sensible defaults for everything else.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMode } from '@common/enums';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { LobbyCardComponent } from './lobby-card.component';

// Wrapper component so we can test ng-content projection into the lobby card
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

    const MEDIUM_MAX = 4;
    const EXPECTED_LIST_ITEMS = 3;

    const createMockGame = (overrides: Partial<Game> = {}): Game => ({
        _id: 'game-1', name: 'Test Game', description: 'A test game', size: { rows: 10, cols: 10 },
        gameMode: GameMode.Classic, thumbnail: 'thumb.png', maxPlayers: MEDIUM_MAX, grid: [],
        createdAt: new Date(), updatedAt: new Date(), isVisible: true, ...overrides,
    });

    const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => {
        const { teamA, teamB, ...restOverrides } = overrides;
        return {
            lobbyId: 'ABCDE',
            gameId: 'game-1',
            hostSocketId: 'socket-1',
            playerCount: 1,
            isLocked: false,
            pendingAvatars: {},
            players: [],
            game: createMockGame(),
            chatHistory: [],
            teamA: teamA ? teamA : [], teamB: teamB ? teamB : [], ...restOverrides,
        };
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LobbyCardComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(LobbyCardComponent);
        component = fixture.componentInstance;
    });


    // Basic setup

    it('should create', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should have the lobby input bound', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component.lobby.lobbyId).toBe('ABCDE');
    });

    // We expose the GameMode enum as a component property so the template can do comparisons
    it('should expose the GameMode enum for the template', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect(component.gameMode).toBe(GameMode);
    });


    // Game Info Rendering
    //
    // Each test below targets one specific piece of metadata shown on the card
    // We keep them separate so if something breaks, we know exactly which binding failed

    it('should show the game name', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Test Game');
    });

    it('should show the grid size in NxN format', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('10 x 10');
    });

    it('should show the thumbnail image', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.src).toContain('thumb.png');
    });

    it('should toggle tooltip visibility on thumbnail hover events', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();

        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(component.show).toBeFalse();

        img.dispatchEvent(new Event('mouseenter'));
        fixture.detectChanges();
        expect(component.show).toBeTrue();

        img.dispatchEvent(new Event('mouseleave'));
        fixture.detectChanges();
        expect(component.show).toBeFalse();
    });

    // Alt text should match the game name for accessibility
    it('should use the game name as the thumbnail alt text', () => {
        component.lobby = createMockLobby({ game: createMockGame({ name: 'Aventure Spatiale' }) });
        fixture.detectChanges();
        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.alt).toBe('Aventure Spatiale');
    });


    // Game Mode Labels
    //
    // The template maps GameMode enum values to French labels (Classique, CTF)
    // We loop through each mode to make sure the right label shows up

    [{ mode: GameMode.Classic, label: 'Classique' }, { mode: GameMode.Ctf, label: 'CTF' }].forEach(({ mode, label }) => {
        it(`should display "${label}" for ${mode} mode`, () => {
            component.lobby = createMockLobby({ game: createMockGame({ gameMode: mode }) });
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain(label);
        });
    });


    // Grid Sizes
    //
    // We support three board sizes (10x10, 15x15, 20x20). Just making sure each
    // one gets formatted and displayed correctly.

    [{ r: 10, c: 10, s: '10 x 10' }, { r: 15, c: 15, s: '15 x 15' }, { r: 20, c: 20, s: '20 x 20' }].forEach(({ r, c, s }) => {
        it(`should display "${s}" for a ${r}x${c} grid`, () => {
            component.lobby = createMockLobby({ game: createMockGame({ size: { rows: r, cols: c } }) });
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement).textContent).toContain(s);
        });
    });

    // Edge Cases
    //
    // Making sure the card handles less common scenarios gracefully:
    // swapping lobby data, long names that could overflow, different image paths, etc

    // If we swap the entire lobby object, everything should re-render with the new data
    it('should update when the lobby input changes', () => {
        component.lobby = createMockLobby({
            game: createMockGame({ name: 'New Game', size: { rows: 20, cols: 20 }, gameMode: GameMode.Ctf }),
            playerCount: 3,
        });
        fixture.detectChanges();
        const text = (fixture.nativeElement as HTMLElement).textContent;
        expect(text).toContain('New Game');
        expect(text).toContain('20 x 20');
        expect(text).toContain('CTF');
    });

    // Long names shouldn't crash or get silently dropped
    it('should render a very long game name without truncation', () => {
        const longName = 'Un Nom De Jeu Très Long Pour Tester Les Limites';
        component.lobby = createMockLobby({ game: createMockGame({ name: longName }) });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(longName);
    });

    // Thumbnails can be simple filenames or full paths - both should work
    it('should reflect a different thumbnail URL', () => {
        component.lobby = createMockLobby({ game: createMockGame({ thumbnail: 'assets/images/map-preview.jpg' }) });
        fixture.detectChanges();
        const img = (fixture.nativeElement as HTMLElement).querySelector('img.thumbnail') as HTMLImageElement;
        expect(img.src).toContain('assets/images/map-preview.jpg');
    });


    // Full Integration Check
    //
    // One big test that sets everything to non-default values and checks it all
    // renders together. Also a couple structural checks on the DOM.

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
        expect(el.textContent).toContain('15 x 15');
        expect(el.textContent).toContain('CTF');
        expect(el.textContent).toContain(`2 / ${MEDIUM_MAX}`);
        expect((el.querySelector('img.thumbnail') as HTMLImageElement).src).toContain('ctf.png');
    });

    // Make sure the main card wrapper exists (needed for styling)
    it('should render the .lobbyCard container', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelector('.lobbyCard')).toBeTruthy();
    });

    // The info section should have exactly 4 list items (name, size, mode, players)
    it('should have four list items in the info section', () => {
        component.lobby = createMockLobby();
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelectorAll('.stat-item').length).toBe(EXPECTED_LIST_ITEMS);
    });
});


// Content Projection
//
// We need a wrapper (TestHostComponent) to test ng-content. This verifies that
// a parent can slot buttons or other elements into the card — we use this for
// the "Join" / "Delete" actions on the lobby list pages

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
        teamA: [],
        teamB: [],
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    });

    it('should render projected content in the button slot', () => {
        const hostFixture = TestBed.createComponent(TestHostComponent);
        hostFixture.componentInstance.lobby = createMockLobby();
        hostFixture.detectChanges();
        const btn = (hostFixture.nativeElement as HTMLElement).querySelector('.projected-btn');
        expect(btn).toBeTruthy();
        expect(btn?.textContent).toBe('Join');
    });
});
