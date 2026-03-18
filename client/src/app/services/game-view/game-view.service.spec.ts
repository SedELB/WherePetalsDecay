import { TestBed } from '@angular/core/testing';

import { GameViewService } from './game-view.service';

describe('GameViewService', () => {
    let service: GameViewService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(GameViewService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
