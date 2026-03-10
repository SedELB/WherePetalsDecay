import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameValidatorService } from '@app/services/game-validator/game-validator.service';
import { TileItemCounts } from '@app/services/map-setup.types';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { Game } from '@common/game';
import html2canvas from 'html2canvas';
import swal from 'sweetalert2';

const THUMBNAIL_QUALITY = 0.85;
const THUMBNAIL_MAX_SIZE = 256;
export interface MapSetupInitResult {
  game: Game;
  mode: 'create' | 'edit';
  itemCounts: TileItemCounts;
}

@Injectable({ providedIn: 'root' })
export class MapSetupFacadeService {
  constructor(
    private readonly router: Router,
    private readonly gameValidator: GameValidatorService,
    private readonly mapSetupService: MapSetupService,
    private readonly tileItemCountService: TileItemCountService,
    private readonly route: ActivatedRoute,
  ) {}

  private readonly communicationService = inject(CommunicationService);

  async initializeFromNavigation(): Promise<MapSetupInitResult | null> {
    const state = history.state as { game?: Game; mode?: 'create' | 'edit' };

    if (state?.game) {
      const stateGame = state.game;
      const stateMode = state.mode ?? 'edit';
      this.mapSetupService.initializeGridIfEmpty(stateGame);
      const stateItemCounts = this.tileItemCountService.createRequiredCounts(stateGame);
      this.tileItemCountService.adjustCountsForExistingItems(stateGame, stateItemCounts);
      return { game: stateGame, mode: stateMode, itemCounts: stateItemCounts };
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.router.navigate(['/admin']);
      return null;
    }

    const fetchedGame = await this.communicationService.getGameById(id).toPromise();
    if (!fetchedGame) {
      this.router.navigate(['/admin']);
      return null;
    }

    this.mapSetupService.initializeGridIfEmpty(fetchedGame);
    const fetchedItemCounts = this.tileItemCountService.createRequiredCounts(fetchedGame);
    this.tileItemCountService.adjustCountsForExistingItems(fetchedGame, fetchedItemCounts);
    return { game: fetchedGame, mode: 'edit', itemCounts: fetchedItemCounts };
  }

  navigateToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  async saveGame(game: Game, initialMode: 'create' | 'edit'): Promise<void> {
    let mode = initialMode;


    try {
      const thumbnail = await this.captureThumbnail();
      game.thumbnail = thumbnail;
    } catch {
      // alert("Problème d'enregistrement : la génération de l'image a échouée ");
      swal.fire({
        title: `Problème d'enregistrement`,
        text: `La génération de l'image a échoué.`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }

    const validation = this.gameValidator.validate(this.mapSetupService.buildValidationPayload(game));

    if (!validation.isValid) {
      swal.fire({
        title: 'Jeu invalide !',
        html: `<div style="text-align:left; white-space:pre-line">- ${validation.errors.join('\n- ')}</div>`,
        icon: 'error',
        confirmButtonText: 'OK',
        scrollbarPadding: false,
      });
      return;
    }

    if (mode === 'edit') {
      this.communicationService.getAllGames().subscribe((allGames) => {
        const originalGame = allGames.find((currentGame) => currentGame._id === game._id);
        if (!originalGame) {
          mode = 'create';
        }

        const saveOperation = mode === 'create'
          ? this.communicationService.createGame(game)
          : this.communicationService.modifyGame(game);

        saveOperation.subscribe({
          next: () => {
            swal.fire({
              title: 'Succès',
              text: `Jeu ${mode === 'create' ? 'créé' : 'sauvegardé'} avec succès !`,
              icon: 'success',
              confirmButtonText: 'OK',
            });
            this.router.navigate(['/admin']);
          },
          error: (err: HttpErrorResponse) => {
            swal.fire({
              title: 'Jeu invalide !',
              html: `<div style="text-align:left; white-space:pre-line">${err.error.replace(/\\n/g, '\n')}</div>`,
              icon: 'error',
              confirmButtonText: 'OK',
              scrollbarPadding: false,
            });
          },
        });
      });
    } else {
      const saveOperation = this.communicationService.createGame(game);

      saveOperation.subscribe({
        next: () => {
          swal.fire({
            title: 'Succès',
            text: `Jeu créé avec succès`,
            icon: 'success',
            confirmButtonText: 'OK',
          });
          this.router.navigate(['/admin']);
        },
        error: (err: HttpErrorResponse) => {
          alert(`Une erreur s'est produite en enregistrant un nouveau jeu : ${err.error}`);
        },
      });
    }
  }

  // Generated by Claude Haiku 4.5 02/09/2026 (for the quality diminuation)
  private async captureThumbnail(): Promise<string> {
    const element = document.getElementById('thumbnail');
    if (!element) {
      throw new Error('image de prévisualisation est introuvable');
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: null,
      imageTimeout: 0,
      scrollX: 0,
      scrollY: -window.scrollY, // compense le scroll actuel
      foreignObjectRendering: false,
    });

    const maxSize = THUMBNAIL_MAX_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible d'obtenir le contexte du canvas");

    const width = canvas.width > canvas.height ? maxSize : (canvas.width / canvas.height) * maxSize;
    const height = canvas.height > canvas.width ? maxSize : (canvas.height / canvas.width) * maxSize;

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;

    const resizedCtx = resizedCanvas.getContext('2d');
    if (!resizedCtx) throw new Error("Impossible d'obtenir le contexte du canvas redimensionné");

    resizedCtx.imageSmoothingEnabled = true;
    resizedCtx.imageSmoothingQuality = 'high';
    resizedCtx.drawImage(canvas, 0, 0, width, height);

    return resizedCanvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);
  }
}
