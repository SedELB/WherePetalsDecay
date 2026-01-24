import { Component } from '@angular/core';

import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})


export class AdminPageComponent {

}
