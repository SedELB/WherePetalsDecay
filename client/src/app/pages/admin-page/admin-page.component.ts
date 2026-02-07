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

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.getGames();
  }

  getGames(): void{
    this.communicationService.getAllGames().subscribe({
      next: (games) => {
        this.games = games;
        // console.log(JSON.stringify(games));
      },
      error: () => {
        // console.error(JSON.stringify(err.error, null, 2));
      },
    });
  }

  games1: GameCard[] = [
    {id: 1, image: '/assets/filler.png', name: 'Game 1', size: '10X10',
      mode: 'Solo', date: '2026-01-01', visible: true,
      imgDescription: 'blablabladsssssssssmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm'},
    {id: 2, image: '/assets/filler.png', name: 'Game 2', size: '20X20', mode: 'Solo', date: '2026-01-05', visible: true, imgDescription: 'blablabla'},
    {id: 3, image: '/assets/filler.png', name: 'Game 3', size: '5X5', mode: 'Co-op', date: '2026-01-10', visible: true, imgDescription: 'blablabla'},
  ];

  removeGame(id: number) {
    this.games1 = this.games1.filter(game => game.id !== id);
  }

  changeVisibility(id: number) {
    const game = this.games1.find(g => g.id === id);
    if (game) {
      game.visible = !game.visible;
    }
  }
}
