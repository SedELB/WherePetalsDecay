import { Component, Input, EventEmitter, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-button',
  imports: [NgClass, RouterLink],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {

  @Output() clicked = new EventEmitter<void>();

  onClick(){
    if (!this.disabled){
      this.clicked.emit();
    }
  }

  @Input() color: string = 'white';
  @Input() backgroundColor: string = '#95698D';
  @Input() width?: number;
  @Input() height?: number;
  @Input() disabled: boolean = false;
  @Input() backgroundPath?: string;
  @Input() route?: string;
  @Input() selected: boolean = false;

  // here is what we call a getter in Angular, it acts as an attribute that returns the return value in question
  // For example : this.backgroundImage = "url(random/path)" if i define background path as "random/path"
  get backgroundImage() {
    return this.backgroundPath ? `url(${this.backgroundPath})` : null;
  }
}
