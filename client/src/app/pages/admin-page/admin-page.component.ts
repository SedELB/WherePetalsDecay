import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';

@Component({
  selector: 'app-admin-page',
  imports: [RouterLink, GameCardComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})


export class AdminPageComponent {

}
