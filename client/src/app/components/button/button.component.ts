import { NgClass, NgStyle } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonVariant } from '@common/enums';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

const DEFAULT_DEBOUNCE_MS = 100;

@Component({
    selector: 'app-button',
    standalone: true,
    imports: [NgClass, RouterLink, NgStyle],
    templateUrl: './button.component.html',
    styleUrl: './button.component.scss',
})

export class ButtonComponent implements OnDestroy {
    protected readonly buttonVariant = ButtonVariant;
    isMenuOpen: boolean = false;
    @Input() color: string = 'white';
    @Input() backgroundColor: string | null = null;
    @Input() width?: number;
    @Input() height?: number;
    @Input() disabled: boolean = false;
    @Input() backgroundPath?: string;
    @Input() route?: string;
    @Input() selected: boolean = false;
    @Input() variant: ButtonVariant = ButtonVariant.Default;
    @Input() isVisible: boolean = false;

    @Output() clicked = new EventEmitter<void>();
    @Output() profileSelected = new EventEmitter<string>();

    private clickSubject = new Subject<void>();
    private toggleSubject = new Subject<void>();
    private profileSubject = new Subject<string>();
    private subscriptions = new Subscription();

    constructor() {
        this.subscriptions.add(
            this.clickSubject.pipe(debounceTime(DEFAULT_DEBOUNCE_MS)).subscribe(() => this.clicked.emit()),
        );
        this.subscriptions.add(
            this.toggleSubject.pipe(debounceTime(DEFAULT_DEBOUNCE_MS)).subscribe(() => (this.isMenuOpen = !this.isMenuOpen)),
        );
        this.subscriptions.add(
            this.profileSubject.pipe(debounceTime(DEFAULT_DEBOUNCE_MS)).subscribe((profile) => {
                this.profileSelected.emit(profile);
                this.isMenuOpen = false;
            }),
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    onClick(): void {
        if (!this.disabled) {
            this.clickSubject.next();
        }
    }

    toggleMenu(): void {
        if (!this.disabled) {
            this.toggleSubject.next();
        }
    }

    onProfileSelected(profile: string): void {
        if (!this.disabled) {
            this.profileSubject.next(profile);
        }
    }

    get backgroundImage(): string | null {
        return this.backgroundPath ? `url(${this.backgroundPath})` : null;
    }
}
