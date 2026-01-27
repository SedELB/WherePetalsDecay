import { NgClass} from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameCard } from '@app/interfaces/gameCard';

@Component({
  selector: 'app-game-card',
  imports: [NgClass],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  standalone: true,
})
export class GameCardComponent {

  @Input() game!: GameCard;
  @Output() removeParent = new EventEmitter<void>();

  show = true;

}
