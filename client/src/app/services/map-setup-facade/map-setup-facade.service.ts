import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameValidatorService } from '@app/services/game-validator/game-validator.service';
import { TileItemCounts } from '@app/services/map-setup.types';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { MapSetupMode } from '@common/enums';
import { Game } from '@common/game';
import html2canvas from 'html2canvas';
import { firstValueFrom } from 'rxjs';
import swal from 'sweetalert2';

import { THUMBNAIL_MAX_SIZE, THUMBNAIL_QUALITY } from '@app/constants/map-setup-page-constant';
interface MapSetupInitResult {
  game: Game;
  mode: MapSetupMode;
  itemCounts: TileItemCounts;
}

@Injectable({ providedIn: 'root' })
export class MapSetupFacadeService {
  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);

  constructor(
    private readonly router: Router,
    private readonly gameValidator: GameValidatorService,
    private readonly mapSetupService: MapSetupService,
    private readonly tileItemCountService: TileItemCountService,
    private readonly route: ActivatedRoute,
  ) {}

  private readonly communicationService = inject(CommunicationService);

  async initializeFromNavigation(): Promise<MapSetupInitResult | null> {
    const state = history.state as { game?: Game; mode?: MapSetupMode };

    if (state?.game) {
      const stateGame = state.game;
      const stateMode = state.mode ?? MapSetupMode.Edit;
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

    const fetchedGame = await firstValueFrom(this.communicationService.getGameById(id));
    if (!fetchedGame) {
      this.router.navigate(['/admin']);
      return null;
    }

    this.mapSetupService.initializeGridIfEmpty(fetchedGame);
    const fetchedItemCounts = this.tileItemCountService.createRequiredCounts(fetchedGame);
    this.tileItemCountService.adjustCountsForExistingItems(fetchedGame, fetchedItemCounts);
    return { game: fetchedGame, mode: MapSetupMode.Edit, itemCounts: fetchedItemCounts };
  }

  navigateToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  async saveGame(game: Game, initialMode: MapSetupMode, thumbnailElement: HTMLElement): Promise<void> {
    let mode = initialMode;

    try {
      const thumbnail = await this.captureThumbnail(thumbnailElement);
      game.thumbnail = thumbnail;
    } catch {
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

    if (mode === MapSetupMode.Edit) {
      this.communicationService.getAllGames().subscribe((allGames) => {
        const originalGame = allGames.find((currentGame) => currentGame._id === game._id);
        if (!originalGame) {
          mode = MapSetupMode.Create;
        }

        const saveOperation = mode === MapSetupMode.Create
          ? this.communicationService.createGame(game)
          : this.communicationService.modifyGame(game);

        saveOperation.subscribe({
          next: () => {
            swal.fire({
              title: 'Succès',
              text: `Jeu ${mode === MapSetupMode.Create ? 'créé' : 'sauvegardé'} avec succès !`,
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
          swal.fire({
            title: 'Erreur',
            text: `Une erreur s'est produite en enregistrant un nouveau jeu : ${err.error}`,
            icon: 'error',
            confirmButtonText: 'OK',
          });
        },
      });
    }
  }

  // Generated by Claude Haiku 4.5 02/09/2026 (for the quality diminuation)
  private async captureThumbnail(element: HTMLElement): Promise<string> {
    const rect = element.getBoundingClientRect();
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: null,
      imageTimeout: 0,
      scrollX: 0,
      scrollY: -(rect.top - element.offsetTop),
      foreignObjectRendering: false,
    });

    const maxSize = THUMBNAIL_MAX_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible d'obtenir le contexte du canvas");

    const width = canvas.width > canvas.height ? maxSize : (canvas.width / canvas.height) * maxSize;
    const height = canvas.height > canvas.width ? maxSize : (canvas.height / canvas.width) * maxSize;

    const resizedCanvas: HTMLCanvasElement = this.renderer.createElement('canvas');
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
