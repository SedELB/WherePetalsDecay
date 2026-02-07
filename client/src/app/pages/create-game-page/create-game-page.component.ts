import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
  selector: 'app-create-game-page',
  imports: [ButtonComponent],
  templateUrl: './create-game-page.component.html',
  styleUrl: './create-game-page.component.scss',
})
export class CreateGamePageComponent {
  
  gameMode: string | null = null;
  mapSize: string | null = null;


  gameModeSelected(gameMode: string){
    this.gameMode = gameMode;
  }

  mapSizeSelected(mapSize: string){
    this.mapSize = mapSize;
  }

  get canCreateGame(){
    return !!this.gameMode && !!this.mapSize;
  }

}
