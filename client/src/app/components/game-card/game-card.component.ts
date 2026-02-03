import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameCard } from '@app/interfaces/game';

@Component({
  selector: 'app-game-card',
  imports: [NgClass],
  standalone: true,
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})

export class GameCardComponent {
  @Input() game: GameCard = {
    id: 0,
    image: '',
    name: '',
    size: { rows: 10, cols: 10 },
    mode: '',
    date: '',
    imgDescription: '',
    visible: true,
  };

  @Output() removeParent = new EventEmitter<void>();
  show = false;
}
