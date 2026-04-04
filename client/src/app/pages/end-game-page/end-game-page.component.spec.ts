/**
 * Tests for EndGamePageComponent
 *
 * Post-game stats screen: sortable player table, global stats, chat.
 * GameViewService mocked with writable signals.
 */
/* eslint-disable @typescript-eslint/no-magic-numbers */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { GameStats } from '@common/interfaces/game-stats';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { EndGamePageComponent } from './end-game-page.component';

@Component({ template: '', standalone: true })
class DummyComponent {}

const LOCAL = 'local-socket';
const OTHER = 'other-socket';

const mkChar = (name = 'Test') => ({
    name, avatar: 'a.png', life: 6, speed: 4,
    attack: 4, defense: 4, lifeBonus: false,
    attackDice: 'D6' as const, defenseDice: 'D4' as const,
});

const mkPlayer = (
    id: string, ov: Partial<Player> = {},
): Player => ({
    socketId: id, isHost: false, winsCount: 0,
    hasAbandonned: false, combatCount: 0, lossCount: 0,
    totalHpLost: 0, totalHpDealt: 0, visitedTilesCount: 0,
    character: mkChar(`Player-${id}`), ...ov,
});

const mkStats = (ov: Partial<GameStats> = {}): GameStats => ({
    gameDurationSeconds: 120, totalTurns: 10,
    totalTerrainTiles: 100, visitedTilesPercentage: 45.5,
    sanctuaryUsagePercentage: null,
    doorsManipulatedPercentage: null,
    uniqueFlagHoldersCount: null, ...ov,
});

describe('EndGamePageComponent', () => {
    let component: EndGamePageComponent;
    let fixture: ComponentFixture<EndGamePageComponent>;
    let router: Router;

    const svc = {
        endGamePlayers: signal<Player[]>([]),
        endGameStats: signal<GameStats | null>(null),
        gameLobby: signal<Lobby | null>(null),
        gameOver: signal<{
            winnerSocketId: string | null;
            isForfeit: boolean;
        } | null>(null),
        getLocalSocketId: jasmine.createSpy('id').and.returnValue(LOCAL),
    };

    beforeEach(async () => {
        svc.endGamePlayers.set([]);
        svc.endGameStats.set(null);
        svc.gameLobby.set(null);
        svc.gameOver.set(null);

        await TestBed.configureTestingModule({
            imports: [EndGamePageComponent],
            providers: [
                provideRouter([
                    { path: 'home', component: DummyComponent },
                ]),
                { provide: GameViewService, useValue: svc },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        fixture = TestBed.createComponent(EndGamePageComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // -- Init --

    describe('ngOnInit', () => {
        it('should redirect home when no players', () => {
            spyOn(router, 'navigate');
            component.ngOnInit();
            expect(router.navigate).toHaveBeenCalledWith(['/home']);
        });

        it('should stay when players exist', () => {
            spyOn(router, 'navigate');
            svc.endGamePlayers.set([mkPlayer(LOCAL)]);
            component.ngOnInit();
            expect(router.navigate).not.toHaveBeenCalled();
        });
    });

    // -- Computed --

    describe('localPlayer', () => {
        it('should find the local player', () => {
            svc.endGamePlayers.set([mkPlayer(LOCAL), mkPlayer(OTHER)]);
            expect(component.localPlayer()?.socketId).toBe(LOCAL);
        });

        it('should return null if absent', () => {
            svc.endGamePlayers.set([mkPlayer(OTHER)]);
            expect(component.localPlayer()).toBeNull();
        });
    });

    // -- Sorting --

    describe('sorting', () => {
        it('should default to winsCount desc', () => {
            expect(component.sortColumn()).toBe('winsCount');
            expect(component.sortAscending()).toBe(false);
        });

        it('should toggle direction on same column', () => {
            component.onSort('winsCount');
            expect(component.sortAscending()).toBe(true);
        });

        it('should reset to desc on new column', () => {
            component.onSort('winsCount');
            component.onSort('name');
            expect(component.sortAscending()).toBe(false);
        });

        it('should show correct indicators', () => {
            expect(component.sortIndicator('winsCount')).toBe(' ▼');
            component.onSort('winsCount');
            expect(component.sortIndicator('winsCount')).toBe(' ▲');
            expect(component.sortIndicator('name')).toBe('');
        });
    });

    describe('sortedPlayers', () => {
        beforeEach(() => {
            svc.endGamePlayers.set([
                mkPlayer(LOCAL, {
                    winsCount: 1, combatCount: 5,
                    character: mkChar('Charlie'),
                }),
                mkPlayer(OTHER, {
                    winsCount: 3, combatCount: 2,
                    character: mkChar('Alice'),
                }),
                mkPlayer('third', {
                    winsCount: 2, combatCount: 3,
                    character: mkChar('Bob'),
                }),
            ]);
            svc.endGameStats.set(mkStats());
        });

        it('should sort by wins desc by default', () => {
            const s = component.sortedPlayers();
            expect(s[0].winsCount).toBe(3);
            expect(s[2].winsCount).toBe(1);
        });

        it('should sort by name asc when toggled twice', () => {
            component.onSort('name');
            component.onSort('name');
            expect(component.sortedPlayers()[0].character.name)
                .toBe('Alice');
        });

        it('should sort by visitedTilesPercent', () => {
            svc.endGamePlayers.set([
                mkPlayer('a', { visitedTilesCount: 80 }),
                mkPlayer('b', { visitedTilesCount: 20 }),
                mkPlayer('c', { visitedTilesCount: 50 }),
            ]);
            component.onSort('visitedTilesPercent');
            expect(component.sortedPlayers()[0].visitedTilesCount)
                .toBe(80);
        });
    });

    // -- Formatters --

    describe('formatDuration', () => {
        const cases: [number, string][] = [
            [120, '02:00'], [65, '01:05'], [0, '00:00'],
            [9, '00:09'], [754, '12:34'],
        ];
        cases.forEach(([input, expected]) => {
            it(`should format ${input}s as "${expected}"`, () => {
                expect(component.formatDuration(input)).toBe(expected);
            });
        });
    });

    describe('formatPercent', () => {
        it('should format with 1 decimal + %', () => {
            expect(component.formatPercent(45.5)).toBe('45.5%');
            expect(component.formatPercent(0)).toBe('0.0%');
            expect(component.formatPercent(100)).toBe('100.0%');
        });
    });

    describe('visitedPercent', () => {
        it('should compute % from tiles and total', () => {
            svc.endGameStats.set(mkStats({ totalTerrainTiles: 200 }));
            const p = mkPlayer(LOCAL, { visitedTilesCount: 50 });
            expect(component.visitedPercent(p)).toBe('25.0%');
        });

        it('should return "0%" for zero total or null stats', () => {
            svc.endGameStats.set(mkStats({ totalTerrainTiles: 0 }));
            expect(component.visitedPercent(mkPlayer('x'))).toBe('0%');
            svc.endGameStats.set(null);
            expect(component.visitedPercent(mkPlayer('x'))).toBe('0%');
        });
    });

    // -- Identity helpers --

    describe('getWinnerName / isWinner / isMe', () => {
        it('should return the winner name', () => {
            svc.endGamePlayers.set([mkPlayer(OTHER)]);
            svc.gameOver.set({
                winnerSocketId: OTHER, isForfeit: false,
            });
            expect(component.getWinnerName())
                .toBe(`Player-${OTHER}`);
        });

        it('should return "" when no winner', () => {
            svc.gameOver.set(null);
            expect(component.getWinnerName()).toBe('');
        });

        it('should identify winner and local player', () => {
            svc.gameOver.set({
                winnerSocketId: LOCAL, isForfeit: false,
            });
            expect(component.isWinner(mkPlayer(LOCAL))).toBe(true);
            expect(component.isWinner(mkPlayer(OTHER))).toBe(false);
            expect(component.isMe(mkPlayer(LOCAL))).toBe(true);
            expect(component.isMe(mkPlayer(OTHER))).toBe(false);
        });
    });

    describe('onReturnHome', () => {
        it('should navigate to /home', () => {
            spyOn(router, 'navigate');
            component.onReturnHome();
            expect(router.navigate).toHaveBeenCalledWith(['/home']);
        });
    });

    describe('stats getter', () => {
        it('should reflect the signal value', () => {
            svc.endGameStats.set(mkStats({ totalTurns: 42 }));
            expect(component.stats?.totalTurns).toBe(42);
            svc.endGameStats.set(null);
            expect(component.stats).toBeNull();
        });
    });

    // -- Template --

    describe('template', () => {
        beforeEach(() => {
            svc.endGamePlayers.set([
                mkPlayer(LOCAL, {
                    isHost: true, winsCount: 3, combatCount: 5,
                    lossCount: 2, totalHpLost: 10, totalHpDealt: 15,
                    visitedTilesCount: 40,
                }),
                mkPlayer(OTHER, {
                    winsCount: 1, hasAbandonned: true,
                    visitedTilesCount: 20,
                }),
            ]);
            svc.endGameStats.set(mkStats({
                sanctuaryUsagePercentage: 50.0,
                doorsManipulatedPercentage: 33.3,
            }));
            svc.gameOver.set({
                winnerSocketId: LOCAL, isForfeit: false,
            });
            svc.gameLobby.set({ lobbyId: 'lobby-1' } as Lobby);
            fixture.detectChanges();
        });

        it('should render title and winner banner', () => {
            const t = fixture.nativeElement.textContent;
            expect(t).toContain('Fin de partie');
            expect(t).toContain('Félicitations');
        });

        it('should render 7 column headers and 2 rows', () => {
            const ths = fixture.nativeElement.querySelectorAll('th');
            const rows = fixture.nativeElement.querySelectorAll('tbody tr');
            expect(ths.length).toBe(7);
            expect(rows.length).toBe(2);
        });

        it('should show Vous and Abandonné badges', () => {
            const t = fixture.nativeElement.textContent;
            expect(t).toContain('Vous');
            expect(t).toContain('Abandonné');
        });

        it('should show conditional stats when not null', () => {
            const t = fixture.nativeElement.textContent;
            expect(t).toContain('Sanctuaires utilisés');
            expect(t).toContain('Portes manipulées');
            expect(t).not.toContain('détenu le drapeau');
        });

        it('should show CTF flag stat when present', () => {
            svc.endGameStats.set(mkStats({ uniqueFlagHoldersCount: 2 }));
            fixture.detectChanges();
            const t = fixture.nativeElement.textContent;
            expect(t).toContain('détenu le drapeau');
        });

        it('should show "sans gagnant" when no winner', () => {
            svc.gameOver.set({ winnerSocketId: null, isForfeit: true });
            fixture.detectChanges();
            expect(fixture.nativeElement.textContent)
                .toContain('sans gagnant');
        });

        it('should render chat and return button', () => {
            expect(fixture.nativeElement.querySelector('app-chat'))
                .toBeTruthy();
            expect(fixture.nativeElement.textContent)
                .toContain('Retour');
        });
    });
});