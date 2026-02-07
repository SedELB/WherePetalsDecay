import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GameService } from './game.service';

describe('GameService', () => {
    let service: GameService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [GameService],
        });
        service = TestBed.inject(GameService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should return correct size label for small map', () => {
        const size = { rows: 10, cols: 10 };
        expect(service.getSizeLabel(size)).toBe('Petite (10x10)');
    });

    it('should return correct size label for medium map', () => {
        const size = { rows: 15, cols: 15 };
        expect(service.getSizeLabel(size)).toBe('Moyenne (15x15)');
    });

    it('should return correct size label for large map', () => {
        const size = { rows: 20, cols: 20 };
        expect(service.getSizeLabel(size)).toBe('Grande (20x20)');
    });
});