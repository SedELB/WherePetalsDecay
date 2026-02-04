import { Component, OnInit } from '@angular/core';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCard } from '@app/interfaces/gameCard';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication.service';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})


export class AdminPageComponent implements OnInit {

  games: Game[] = [];
  gameCards: GameCard[] = [];

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.getGames();
  }

  getGames(): void{
    this.communicationService.getAllGames().subscribe({
      next: (games) => {
        this.games = games;
        this.gameCards = this.games.map(game => {
          return {
            name: game.name,
            description: game.description,
            size: game.size,
            gameMode: game.gameMode,
            thumbnail: game.thumbnail,
            updatedAt: game.updatedAt,
            isVisible: game.isVisible,
          };
        });
      },
      error: (err) => {
        throw new Error('games were not loaded correctly : ', err);
      },
    });
  }

  removeGame(name: string) {
    this.gameCards = this.gameCards.filter(game => game.name !== name);
  }

  changeVisibility(name: string) {
    const game = this.gameCards.find(g => g.name === name);
    if (game) {
      game.isVisible = !game.isVisible;
    }
  }
}
