import { Component, OnInit } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { Game } from '@app/interfaces/game';
import { GameCard } from '@app/interfaces/gameCard';
import { CommunicationService } from '@app/services/communication.service';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})


export class AdminPageComponent implements OnInit {

  games: GameCard[] = [];

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.getGames();
  }

  getGames(): void {
    this.communicationService.getAllGames().subscribe({
      next: (games) => {
        this.games = games.map((game, index) => this.toGameCard(game, index));
      },
      error: () => {
      },
    });
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

  private toGameCard(game: Game, index: number): GameCard {
    return {
      id: index,
      image: game.thumbnail || '/assets/filler.png',
      name: game.name,
      size: `${game.size.rows}x${game.size.cols}`,
      mode: game.gameMode,
      date: new Date(game.createdAt).toLocaleDateString(),
      visible: game.isVisible,
      imgDescription: game.description,
    };
  }
}
