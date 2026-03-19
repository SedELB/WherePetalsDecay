import { NgClass, NgStyle } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonVariant } from '@common/enums';

@Component({
    selector: 'app-button',
    standalone: true,
    imports: [NgClass, RouterLink, NgStyle],
    templateUrl: './button.component.html',
    styleUrl: './button.component.scss',
})

export class ButtonComponent {
    protected readonly ButtonVariant = ButtonVariant;
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

    onClick(): void {
        if (!this.disabled) {
            this.clicked.emit();
        }
    }

    get backgroundImage(): string | null {
        return this.backgroundPath ? `url(${this.backgroundPath})` : null;
    }
}
