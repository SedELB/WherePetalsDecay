import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { AVAILABLE_GAMES } from '@app/constants/games.constants';
import { GameCard } from '@app/interfaces/game';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  private readonly router = inject(Router);

  games: GameCard[] = AVAILABLE_GAMES.map((g) => ({ ...g }));

  editGame(game: GameCard): void {
    this.router.navigate(['/editor'], { state: { game } });
  }

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
