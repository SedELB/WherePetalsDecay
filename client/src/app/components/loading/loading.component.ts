import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

const DOT_COUNT = 20;
const HIDE_DELAY_MS = 100;
const FADE_DURATION_MS = 200;

@Component({
    selector: 'app-loading',
    standalone: true,
    imports: [],
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.scss'],
})

export class LoadingComponent implements OnChanges, OnDestroy {
    @Input() isLoading = true;
    @Output() hidden = new EventEmitter<void>();

    readonly dots = Array.from({ length: DOT_COUNT });
    visible = true;
    hiding = false;

    private hideTimeout?: ReturnType<typeof setTimeout>;
    private fadeTimeout?: ReturnType<typeof setTimeout>;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.isLoading && !this.isLoading) {
            this.hideTimeout = setTimeout(() => {
                this.hiding = true;
                this.fadeTimeout = setTimeout(() => {
                    this.visible = false;
                    this.hidden.emit();
                }, FADE_DURATION_MS);
            }, HIDE_DELAY_MS);
        } else if (this.isLoading) {
            clearTimeout(this.hideTimeout);
            clearTimeout(this.fadeTimeout);
            this.hiding = false;
            this.visible = true;
        }
    }

    ngOnDestroy(): void {
        clearTimeout(this.hideTimeout);
        clearTimeout(this.fadeTimeout);
    }
}
