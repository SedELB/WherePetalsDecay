import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
  selector: 'app-game-card',
  imports: [ButtonComponent],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  standalone: true,
})
export class GameCardComponent {

}
