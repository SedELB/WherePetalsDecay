import { NgStyle } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-list-container',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './list-container.component.html',
  styleUrl: './list-container.component.scss',
})
export class ListContainerComponent {
  @Input() height: string = '600px';
}