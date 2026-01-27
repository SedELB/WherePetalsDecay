import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-game-card',
  imports: [NgClass],
  standalone: true,
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  standalone: true,
})
export class GameCardComponent {
  @Input() name: string = 'Nom du jeu';
  @Input() size: string = 'Taille';
  @Input() mode: string = 'Mode de jeu';
  @Input() lastModified: string = 'Date de modification';
  @Input() image: string = 'assets/filler.png';
}