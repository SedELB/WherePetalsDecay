import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@common/game';
import { GameMode, MaxPlayers } from '@common/enums';

@Component({
  selector: 'app-create-game-page',
  imports: [ButtonComponent],
  templateUrl: './create-game-page.component.html',
  styleUrl: './create-game-page.component.scss',
})

export class CreateGamePageComponent {
  constructor(private readonly router: Router) {}

  gameModeEnum = GameMode;
  gameMode: GameMode | null = null;
  mapSize: string | null = null;

  sizes: Record<string, { rows: number; cols: number }> = {
    small: { rows: 10, cols: 10 },
    medium: { rows: 15, cols: 15 },
    large: { rows: 20, cols: 20 },
  };

  gameModeSelected(gameMode: GameMode) {
    this.gameMode = gameMode;
  }

  mapSizeSelected(mapSize: string) {
    this.mapSize = mapSize;
  }

  get canCreateGame() {
    return !!this.gameMode && !!this.mapSize;
  }

  private get getMaxPlayers() {
    if (this.mapSize === 'large') return MaxPlayers.Large;
    else if (this.mapSize === 'medium') return MaxPlayers.Medium;
    else if (this.mapSize === 'small') return MaxPlayers.Small;
    else throw new Error(`Error while defining maxPlayer for the game object`);
  }

  createAndNavigateToGameEditor(): void {

    const game: Game = {
      _id: '',
      name: '',
      description: '',
      size: this.sizes[this.mapSize ?? ''] ?? { rows: 0, cols: 0 },
      gameMode: this.gameMode ?? GameMode.Classic,
      thumbnail: '',
      maxPlayers: this.getMaxPlayers,
      grid: [],
      isVisible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.router.navigate(['/editor/new'], { state: { game, mode: 'create' } });
  }

}