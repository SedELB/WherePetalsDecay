import { TestBed } from '@angular/core/testing';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';

describe('GameViewCombatService', () => {
    let service: GameViewCombatService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(GameViewCombatService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
