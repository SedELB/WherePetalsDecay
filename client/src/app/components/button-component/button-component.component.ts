import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-button-component',
  imports: [NgClass],
  templateUrl: './button-component.component.html',
  styleUrl: './button-component.component.scss',
})
export class ButtonComponentComponent {
  @Input() text: string = 'Button de Test ';
  @Input() variant: 'default' | 'back' | 'save' = 'default';
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();

  onClick() {
    if (this.disabled) return;
    this.clicked.emit();
  }
}
