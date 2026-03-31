import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { JournalService } from '@app/services/journal/journal.service';
import { JournalEntry } from '@common/journal-entry';
import { Subscription } from 'rxjs';

const SCROLL_THRESHOLD = 75;

@Component({
    selector: 'app-journal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './journal.component.html',
    styleUrl: './journal.component.scss',
})
export class JournalComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
    @Input() lobbyId: string = '';

    @ViewChild('journalContainer') private journalContainer!: ElementRef<HTMLDivElement>;

    entries: JournalEntry[] = [];
    isNearBottom = true;

    private entriesSub?: Subscription;
    private shouldScroll = false;
    private lastEntryCount = 0;

    constructor(private readonly journalService: JournalService) {}

    ngOnInit(): void {
        this.subscribeToEntries();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.lobbyId && this.lobbyId) {
            this.entriesSub?.unsubscribe();
            this.subscribeToEntries();
        }
    }

    ngAfterViewChecked(): void {
        if (this.shouldScroll && this.isNearBottom) {
            this.shouldScroll = false;
            this.scrollToBottom();
        }
    }

    ngOnDestroy(): void {
        this.entriesSub?.unsubscribe();
    }

    formatTimestamp(date: Date | string): string {
        const d = new Date(date);
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const seconds = d.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    onScroll(): void {
        this.updateScrollPosition();
    }

    scrollToBottomClicked(): void {
        this.scrollToBottom();
        this.isNearBottom = true;
    }

    private subscribeToEntries(): void {
        const lobbyId = this.lobbyId?.trim();
        if (!lobbyId) return;

        this.entriesSub = this.journalService.getEntries$(lobbyId).subscribe((entries) => {
            if (entries.length > this.lastEntryCount) {
                this.shouldScroll = true;
            }
            this.lastEntryCount = entries.length;
            this.entries = entries;
        });
    }

    private updateScrollPosition(): void {
        if (!this.journalContainer?.nativeElement) return;
        const container = this.journalContainer.nativeElement;
        const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
        this.isNearBottom = distanceFromBottom < SCROLL_THRESHOLD;
    }

    private scrollToBottom(): void {
        if (this.journalContainer?.nativeElement) {
            const container = this.journalContainer.nativeElement;
            container.scrollTop = container.scrollHeight;
        }
    }
}
