
import { Component, OnInit, OnDestroy } from '@angular/core';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { GameCard } from '@app/interfaces/gameCard';
import { CommunicationService } from '@app/services/communication.service';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameService } from '@app/services/game.service';
import { Subscription } from 'rxjs';
import { Game } from '@app/interfaces/game';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})

export class AdminPageComponent implements OnInit, OnDestroy {

  games: Game[] = [];
  gameCards: GameCard[] = [];

  private sub?: Subscription;

  constructor(
    private readonly communicationService: CommunicationService,
    private readonly gameService: GameService,
  ) {}

  ngOnInit(): void {
    this.gameService.connect();

    this.communicationService.getAllGames().subscribe({
      next: (games) => this.gameService.setGames(games),
      error: () => {
        throw new Error(`There was an error while fetching all games for database`);
      },
    });

    this.sub = this.gameService.games$.subscribe((games) => {
      this.games = games;
      this.gameCards = games.map(game => ({
        name: game.name,
        description: game.description,
        size: game.size,
        gameMode: game.gameMode,
        thumbnail: game.thumbnail,
        updatedAt: game.updatedAt,
        isVisible: game.isVisible,
      }));
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.gameService.disconnect();
  }

  changeVisibility(name: string) {
    const game = this.games.find(g => g.name === name);
    if (!game) return;
    this.communicationService.updateVisiblity(game).subscribe();
  }

  removeGame(name: string) {
    const game = this.games.find(g => g.name === name);
    if (!game) return;

    this.communicationService.deleteGame(game._id).subscribe();
  }
}