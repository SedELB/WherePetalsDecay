import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameCard } from '@app/interfaces/gameCard';

@Component({
  selector: 'app-game-card',
  imports: [NgClass],
  standalone: true,
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})

export class GameCardComponent {
  @Input() game: GameCard = {
    name: '',
    description: '',
    size: { rows: 0, cols: 0 },
    gameMode: '',
    thumbnail: '',
    updatedAt: new Date(),
    isVisible: true,
  };

  @Output() removeParent = new EventEmitter<void>();
  show = false;
}
