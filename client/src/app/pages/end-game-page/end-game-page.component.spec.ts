import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { EndGamePageComponent } from './end-game-page.component';
import { signal } from '@angular/core';

describe('EndGamePageComponent', () => {
    let component: EndGamePageComponent;
    let fixture: ComponentFixture<EndGamePageComponent>;
    let gameViewServiceSpy: jasmine.SpyObj<GameViewService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        gameViewServiceSpy = jasmine.createSpyObj('GameViewService', ['getLocalSocketId', 'leaveEndGame'], {
            endGamePlayers: signal([]),
            endGameStats: signal(null),
            gameLobby: signal(null),
            gameOver: signal(null),
        });
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [EndGamePageComponent],
            providers: [
                { provide: GameViewService, useValue: gameViewServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: ActivatedRoute, useValue: {} },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(EndGamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should navigate to home if players list is empty on init', () => {
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should call leaveEndGame on destroy if lobbyId exists', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (gameViewServiceSpy.gameLobby as any).set({ lobbyId: '123' });
        
        component.ngOnDestroy();
        
        expect(gameViewServiceSpy.leaveEndGame).toHaveBeenCalledWith('123');
    });

    it('should format duration correctly', () => {
        const testDurationOne = 65;
        const testDurationTwo = 600;
        expect(component.formatDuration(testDurationOne)).toBe('01:05');
        expect(component.formatDuration(0)).toBe('00:00');
        expect(component.formatDuration(testDurationTwo)).toBe('10:00');
    });
});

