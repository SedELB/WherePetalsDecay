import { Component } from '@angular/core';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCard } from '@app/interfaces/gameCard';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent, NgFor],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})


export class AdminPageComponent {

  games: GameCard[] = [
    { id: 1, image: '../../../assets/filler.png', name: 'Game 1', size: '10X10', mode: 'Solo', date: '2026-01-01', visible: true },
    { id: 2, image: '../../../assets/filler.png', name: 'Game 2', size: '20X20', mode: 'Multiplayer', date: '2026-01-05', visible: true },
    { id: 3, image: '../../../assets/filler.png', name: 'Game 3', size: '5X5', mode: 'Co-op', date: '2026-01-10', visible: true },
  ];

  removeGame(id: number) {
    this.games = this.games.filter(game => game.id !== id);
  }

  changeVisibility(id: number) {
    const game = this.games.find(g => g.id === id);
    if (game) {
      game.visible = !game.visible;
    }
  }


}
