import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JournalComponent } from './journal.component';
import { JournalService } from '@app/services/journal/journal.service';

describe('JournalComponent', () => {
    let component: JournalComponent;
    let fixture: ComponentFixture<JournalComponent>;
    let journalServiceSpy: jasmine.SpyObj<JournalService>;

    beforeEach(async () => {
        journalServiceSpy = jasmine.createSpyObj('JournalService', ['getEntriesAsObservable']);
        
        await TestBed.configureTestingModule({
            imports: [JournalComponent],
            providers: [{ provide: JournalService, useValue: journalServiceSpy }],
        }).compileComponents();

        fixture = TestBed.createComponent(JournalComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
