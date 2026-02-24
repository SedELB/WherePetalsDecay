import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { Game } from '@app/interfaces/game';
import { HostedGame } from '@app/interfaces/hostedGame';
import { JoinGameService } from '@app/services/join-game/join-game.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-join-game-page',
  imports: [ButtonComponent, GameCardComponent],
  templateUrl: './join-game-page.component.html',
  styleUrl: './join-game-page.component.scss',
})
export class JoinGamePageComponent implements OnInit, OnDestroy {

  games: Game[] = [];
  gameCards: HostedGame[] = [];
  private subscription?: Subscription;
  
  joinGameService = inject(JoinGameService);

  constructor(
    private readonly router: Router,
  ) {}
  
  ngOnInit(): void {
    this.adminGameService.fetchAllGames().subscribe({
      next: (games) => this.adminGameService.setGames(games),
      error: (error: HttpErrorResponse) => {
        const errorMessage = error.error || 'Erreur lors de la récupération des jeux';
        alert(`Erreur: ${errorMessage}`);
      },
    });

    this.subscription = this.adminGameService.games$.subscribe((games) => {
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
    this.subscription?.unsubscribe();
  }

  navigateToWaitingRoom(name: string): void {
    const game = this.games.find((g) => (g.name === name));
    this.router.navigate(['/waiting-room']);
  }

  changeVisibility(name: string) {
    const game = this.games.find(g => g.name === name);
    if (!game) return;
    this.communicationService.updateVisiblity(game).subscribe({
      error: (error: HttpErrorResponse) => {
        const errorMessage = error.error || 'Erreur lors du changement de visibilité';
        alert(`Erreur: ${errorMessage}`);
      },
    });
  }
}
