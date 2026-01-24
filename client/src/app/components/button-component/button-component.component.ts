import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-button-component',
  imports: [],
  templateUrl: './button-component.component.html',
  styleUrl: './button-component.component.scss',
})
export class ButtonComponentComponent {
  @Input() text: string = 'Button de Test ';
  @Output() clicked = new EventEmitter<void>();

  onClick() {
    this.clicked.emit();
  }
}
