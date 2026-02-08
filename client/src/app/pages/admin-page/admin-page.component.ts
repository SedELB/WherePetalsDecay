import { Component, OnInit } from '@angular/core';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { GameCard } from '@app/interfaces/gameCard';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication.service';
import { ButtonComponent } from '@app/components/button/button.component';

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
        this.games = [];
        this.games = games;
        // keep only the keys you need
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
    const game = this.games.find(g => g.name === name);

    if (!game) return;

    this.communicationService.deleteGame(game._id).subscribe({ 
      next: () => this.getGames(),
      error: (err) => {
        throw new Error(`Error while deleting this game : ${game.name}, error : ${err}`);
      },
    });
  }

  changeVisibility(name: string) {
    const game = this.games.find(g => g.name === name);

    if (!game) return;

    this.communicationService.updateVisiblity(game).subscribe({
      next: () => {
        this.getGames();
      },
      error: (err) => {
        throw new Error(`Error when modifying ${game.name}'s visibility : ${err}`);
      },
    });
  }
}
