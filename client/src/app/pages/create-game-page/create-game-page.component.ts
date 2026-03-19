import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@common/game';
import { ButtonVariant, GameMode, GridSizes, MapSetupMode, MapSizeKey, MaxPlayers } from '@common/enums';


interface MapSizeConfig {
  rows: number;
  cols: number;
  maxPlayers: number;
}

const MAP_SIZE_CONFIG: Record<MapSizeKey, MapSizeConfig> = {
  [MapSizeKey.Small]: { rows: GridSizes.Small, cols: GridSizes.Small, maxPlayers: MaxPlayers.Small },
  [MapSizeKey.Medium]: { rows: GridSizes.Medium, cols: GridSizes.Medium, maxPlayers: MaxPlayers.Medium },
  [MapSizeKey.Large]: { rows: GridSizes.Large, cols: GridSizes.Large, maxPlayers: MaxPlayers.Large },
};

@Component({
  selector: 'app-create-game-page',
  imports: [ButtonComponent],
  templateUrl: './create-game-page.component.html',
  styleUrl: './create-game-page.component.scss',
})

export class CreateGamePageComponent {
  protected readonly ButtonVariant = ButtonVariant;
  constructor(private readonly router: Router) {}

  gameModeEnum = GameMode;
  mapSizeEnum = MapSizeKey;
  gameMode: GameMode | null = null;
  mapSize: MapSizeKey | null = null;

  gameModeSelected(gameMode: GameMode): void {
    this.gameMode = gameMode;
  }

  mapSizeSelected(mapSize: MapSizeKey): void {
    this.mapSize = mapSize;
  }

  get canCreateGame(): boolean {
    return !!this.gameMode && !!this.mapSize;
  }

  private get selectedConfig(): MapSizeConfig {
    if (!this.mapSize || !(this.mapSize in MAP_SIZE_CONFIG)) {
      throw new Error('Invalid map size selection');
    }
    return MAP_SIZE_CONFIG[this.mapSize];
  }

  createAndNavigateToGameEditor(): void {
    const config = this.selectedConfig;

    const game: Game = {
      _id: '',
      name: '',
      description: '',
      size: { rows: config.rows, cols: config.cols },
      gameMode: this.gameMode ?? GameMode.Classic,
      thumbnail: '',
      maxPlayers: config.maxPlayers,
      grid: [],
      isVisible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.router.navigate(['/editor/new'], { state: { game, mode: MapSetupMode.Create } });
  }

}
