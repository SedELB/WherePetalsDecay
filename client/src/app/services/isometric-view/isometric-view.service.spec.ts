import { TestBed } from '@angular/core/testing';
import { IsometricViewService } from './isometric-view.service';

describe('IsometricViewService', () => {
    let service: IsometricViewService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(IsometricViewService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
