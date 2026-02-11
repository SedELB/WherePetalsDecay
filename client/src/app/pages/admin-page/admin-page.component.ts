
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { Game } from '@app/interfaces/game';
import { GameCard } from '@app/interfaces/gameCard';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameService } from '@app/services/game/game.service';
import { Subscription } from 'rxjs';

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
    private readonly router: Router,
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
      this.gameCards = games
        .map(game => ({
          name: game.name,
          description: game.description,
          size: game.size,
          gameMode: game.gameMode,
          thumbnail: game.thumbnail,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
          isVisible: game.isVisible,
        }))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateA.getTime() - dateB.getTime();
        });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.gameService.disconnect();
  }

  navigateToGameEditor(name: string): void {
    const game = this.games.find((g) => (g.name === name));
    this.router.navigate(['/editor'], { state: { game, mode: 'edit' } });
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