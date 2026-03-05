import { NgClass, NgStyle } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-button',
    standalone: true,
    imports: [NgClass, RouterLink, NgStyle],
    templateUrl: './button.component.html',
    styleUrl: './button.component.scss',
})

export class ButtonComponent {
    @Input() color: string = 'white';
    @Input() backgroundColor: string | null = null;
    @Input() width?: number;
    @Input() height?: number;
    @Input() disabled: boolean = false;
    @Input() backgroundPath?: string;
    @Input() route?: string;
    @Input() selected: boolean = false;
    @Input() variant: 'default' | 'back' | 'save' = 'default';

    @Output() clicked = new EventEmitter<void>();

    onClick() {
        if (!this.disabled) {
            this.clicked.emit();
        }
    }

    // here is what we call a getter in Angular, it acts as an attribute that returns the return value in question
    // For example : this.backgroundImage = "url(random/path)" if i define background path as "random/path"
    get backgroundImage() {
        return this.backgroundPath ? `url(${this.backgroundPath})` : null;
    }
}