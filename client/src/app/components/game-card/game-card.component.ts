import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameCard } from '@app/interfaces/gameCard';
import { GameMode } from '@common/enums';

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
    gameMode: GameMode.Classic,
    thumbnail: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isVisible: true,
  };

  @Output() removeParent = new EventEmitter<void>();
  show = false;
  gameMode = GameMode;

  displayTime(): string {
    const rawDate = this.game.createdAt;
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
}
