import { Component, OnInit } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { Character } from '@app/interfaces/character';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { SakuraComponent } from '@app/components/sakura/sakura.component';

@Component({
  selector: 'app-game-page',
  imports: [ButtonComponent, RouterLink, SakuraComponent],
  templateUrl: './game-page.component.html',
  styleUrl: './game-page.component.scss',
})
export class GamePageComponent implements OnInit {
  lobby : Lobby;
  game: Game;
  currentPlayer: Character;

  readonly routes = ROUTES;

  ngOnInit(): void {
    console.log("test");
  }
}
