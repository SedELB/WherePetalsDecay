import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication.service';
import { GameValidatorService } from '@app/services/game-validator.service';
import { MapSetupService, TileItemCounts } from '@app/services/map-setup.service';
import html2canvas from 'html2canvas';

export interface MapSetupInitResult {
  game: Game;
  mode: 'create' | 'edit';
  itemCounts: TileItemCounts;
}

@Injectable({ providedIn: 'root' })
export class MapSetupFacadeService {
  constructor(
    private readonly router: Router,
    private readonly communicationService: CommunicationService,
    private readonly gameValidator: GameValidatorService,
    private readonly mapSetupService: MapSetupService
  ) {}

  initializeFromNavigation(): MapSetupInitResult {
    const state = history.state as { game?: Game; mode?: 'create' | 'edit' };

    if (!state?.game) {
      // Did not send a game object (did not come from our predifined path, fallback)
      this.router.navigate(['/games']);
    }

    const game = state.game as Game;
    const mode = state.mode ?? 'edit';

    this.mapSetupService.initializeGridIfEmpty(game);
    const itemCounts = this.mapSetupService.createRequiredCounts(game);
    this.mapSetupService.adjustCountsForExistingItems(game, itemCounts);

    return { game, mode, itemCounts };
  }

  navigateToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  async saveGame(game: Game, mode: 'create' | 'edit'): Promise<void> {
    if (mode === 'create') {
      try {
        const thumbnail = await this.captureThumbnail(game.name);
        game.thumbnail = thumbnail;
      } catch {
        alert('Save failed: unable to generate map thumbnail.');
        return;
      }
    }

    const validation = this.gameValidator.validate(this.mapSetupService.buildValidationPayload(game));

    if (!validation.isValid) {
      alert(`Jeu invalide:\n- ${validation.errors.join('\n- ')}`);
      return;
    }

    const saveOperation = mode === 'create'
      ? this.communicationService.createGame(game)
      : this.communicationService.modifyGame(game);

    saveOperation.subscribe({
      next: () => {
        alert(`Game ${mode === 'create' ? 'created' : 'saved'} successfully!`);
        this.router.navigate(['/admin']);
      },
      error: (error) => {
        console.error('Error saving game:', error);
        const errorMessage = error.error || error.message || 'Unknown error';
        alert(`Error saving game: ${errorMessage}`);
      }
    });
  }

  private async captureThumbnail(name: string): Promise<string> {
    const element = document.getElementById('tubmnail');

    if (!element) {
      throw new Error('Thumbnail element not found');
    }

    const canvas = await html2canvas(element);
    return canvas.toDataURL(`${name}/png`);
  }
}
