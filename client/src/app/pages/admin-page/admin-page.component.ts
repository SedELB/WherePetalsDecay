import { Component } from '@angular/core';
import { ListContainerComponent } from '@app/components/list-container/list-container.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
  selector: 'app-admin-page',
  imports: [GameCardComponent, ButtonComponent, ListContainerComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})


export class AdminPageComponent {

}
