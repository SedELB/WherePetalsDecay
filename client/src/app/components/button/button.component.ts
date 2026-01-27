import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-button',
    standalone: true,
    imports: [NgClass, RouterLink],
    templateUrl: './button.component.html',
    styleUrl: './button.component.scss',
})
export class ButtonComponent {
    @Input() color: string = 'white';
    @Input() backgroundColor: string = '#95698D';
    @Input() width?: number;
    @Input() height?: number;
    @Input() disabled: boolean = false;
    @Input() backgroundPath?: string;
    @Input() route?: string;
    @Input() selected: boolean = false;

    @Output() clicked = new EventEmitter<void>();

    onClick() {
        if (!this.disabled) {
            this.clicked.emit();
        }
    }

    get backgroundImage() {
        return this.backgroundPath ? `url(${this.backgroundPath})` : null;
    }
}