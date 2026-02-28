import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/pages/map-setup-page/map-setup-page-constant';
import { AdminGameService } from '@app/services/admin-game/admin-game.service';
import { DESC_MAX_LENGTH, NAME_MAX_LENGTH } from '@app/services/game-validator/game-validator.service';
import { MapSetupFacadeService } from '@app/services/map-setup-facade/map-setup-facade.service';
import { TileItemCounts } from '@app/services/map-setup.types';
import { MapSetupService } from '@app/services/map-setup/map-setup.service';
import { TileItemCountService } from '@app/services/tile-item-count/tile-item-count.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import swal from 'sweetalert2';
@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent implements OnInit, OnDestroy {
  constructor(
    private readonly mapSetupFacade: MapSetupFacadeService,
    private readonly mapSetupService: MapSetupService,
    private readonly tileItemCountService: TileItemCountService,
    private readonly adminGameService: AdminGameService,
  ) {}

  private gameSubscription?: Subscription;
  private isSaving = false;
  private saveInProgress = false;
  private gameDeletedAlertShown = false;
  protected gameMode = GameMode;

  nameMaxLength = NAME_MAX_LENGTH;
  descMaxLength = DESC_MAX_LENGTH;

  game: Game = { grid: [] } as unknown as Game;
  mode: 'create' | 'edit' = 'edit';
  private initialGameState: Game | null = null;

  activeTileTexture: TileTexture | null = null;
  activeTileItem: TileItem | null = null;

  readonly objectPlacementTools = OBJECT_PLACEMENT_TOOL;
  readonly tileToolsDescription = TILE_TOOLS;

  readonly objectPlacementToolsArray = Object.values(OBJECT_PLACEMENT_TOOL);
  readonly tileTools = Object.values(TILE_TOOLS).filter(
    (tool) => ![TileTexture.Floor, TileTexture.DoorOpened].includes(tool.type),
  );

  readonly tileItemEnum = TileItem;
  readonly tileTextureEnum = TileTexture;

  private isPaintingTiles = false;
  private isErasingTiles = false;

  private itemCounts: TileItemCounts = {
    spawnCount: 0,
    flagCount: 0,
  };

  async ngOnInit(): Promise<void> {
    const init = await this.mapSetupFacade.initializeFromNavigation();
    if (!init) return;
    this.game = init.game;
    this.mode = init.mode;
    this.itemCounts = init.itemCounts;
    this.initialGameState = JSON.parse(JSON.stringify(this.game));

    if (this.mode === 'edit' && this.game?._id) {
      this.adminGameService.fetchAllGames().subscribe({
        next: (games) => this.adminGameService.setGames(games),
      });
      this.gameSubscription = this.adminGameService.games$.pipe(skip(1)).subscribe((games) => {
        const currentGame = games.find(g => g._id === this.game._id);

        if (!currentGame) {
          if (!this.gameDeletedAlertShown) {
            this.gameDeletedAlertShown = true;
            swal.fire({
              title: 'Jeu supprimé',
              text: 'Ce jeu a été supprimé par un autre administrateur. Vous pouvez continuer à travailler et il sera créé comme un nouveau jeu.',
              icon: 'warning',
              confirmButtonText: 'OK',
            });
          }
          this.mode = 'create';

        } else if (currentGame.updatedAt !== this.game.updatedAt) {
          if (this.isSaving) {
            this.game = JSON.parse(JSON.stringify(currentGame));
            this.itemCounts = this.tileItemCountService.createRequiredCounts(this.game);
            this.tileItemCountService.adjustCountsForExistingItems(this.game, this.itemCounts);
            this.isSaving = false;
          } else {
            const userWantsUpdate = confirm(
              'Ce jeu a été modifié par un autre administrateur. ' +
              'Voulez-vous charger les changements? (Vos modifications locales seront perdues)',
            );
            if (userWantsUpdate) {
              this.game = JSON.parse(JSON.stringify(currentGame));
              this.itemCounts = this.tileItemCountService.createRequiredCounts(this.game);
              this.tileItemCountService.adjustCountsForExistingItems(this.game, this.itemCounts);
            }
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
  }

  getRequiredSpawnCount(): number {
    return this.tileItemCountService.getRequiredSpawnCount(this.game);
  }

  getRequiredFlagCount(): number {
    return this.tileItemCountService.getRequiredFlagCount(this.game);
  }

  countTileTexture(tileTexture: TileTexture): number {
    return this.tileItemCountService.countTileTexture(this.game, tileTexture);
  }

  countTileItem(tileItem: TileItem): number {
    return this.tileItemCountService.countTileItem(this.game, tileItem);
  }

  getPlacedSpawnCount(): number {
    return this.tileItemCountService.getPlacedSpawnCount(this.game);
  }

  getPlacedFlagCount(): number {
    return this.tileItemCountService.getPlacedFlagCount(this.game);
  }

  isObjectTypeComplete(type: TileItem): boolean {
    return this.tileItemCountService.isObjectTypeComplete(this.game, type);
  }

  getObjectAt(x: number, y: number): Tile | undefined {
    return this.mapSetupService.getObjectAt(this.game, x, y);
  }

  selectTileTexture(type: TileTexture): void {
    const selection = this.mapSetupService.selectTileTexture(this.activeTileTexture, this.activeTileItem, type);
    this.activeTileTexture = selection.activeTileTexture;
    this.activeTileItem = selection.activeTileItem;
  }

  selectTileItem(type: TileItem): void {
    const selection = this.mapSetupService.selectTileItem(this.activeTileItem, this.activeTileTexture, type);
    this.activeTileTexture = selection.activeTileTexture;
    this.activeTileItem = selection.activeTileItem;
  }

  onCellMouseDown(rowIndex: number, colIndex: number, event: MouseEvent): void {
    const interactionState = this.mapSetupService.handleCellMouseDown({
      game: this.game,
      rowIndex,
      colIndex,
      event,
      activeTileTexture: this.activeTileTexture,
      activeTileItem: this.activeTileItem,
      counts: this.itemCounts,
      isPaintingTiles: this.isPaintingTiles,
      isErasingTiles: this.isErasingTiles,
    });
    this.isPaintingTiles = interactionState.isPaintingTiles;
    this.isErasingTiles = interactionState.isErasingTiles;
  }

  onCellMouseEnter(rowIndex: number, colIndex: number, event: MouseEvent): void {
    const interactionState = this.mapSetupService.handleCellMouseEnter({
      game: this.game,
      rowIndex,
      colIndex,
      event,
      activeTileTexture: this.activeTileTexture,
      activeTileItem: this.activeTileItem,
      counts: this.itemCounts,
      isPaintingTiles: this.isPaintingTiles,
      isErasingTiles: this.isErasingTiles,
    });
    this.isPaintingTiles = interactionState.isPaintingTiles;
    this.isErasingTiles = interactionState.isErasingTiles;
  }

  onGridMouseLeave(): void {
    const interactionState = this.mapSetupService.resetInteractionState();
    this.isPaintingTiles = interactionState.isPaintingTiles;
    this.isErasingTiles = interactionState.isErasingTiles;
  }

  onDocumentMouseUp(): void {
    const interactionState = this.mapSetupService.resetInteractionState();
    this.isPaintingTiles = interactionState.isPaintingTiles;
    this.isErasingTiles = interactionState.isErasingTiles;
  }

  onBack(): void {
    this.mapSetupFacade.navigateToAdmin();
  }

  async onSave(): Promise<void> {
    if (this.saveInProgress) return;
    this.saveInProgress = true;
    this.isSaving = true;
    await this.mapSetupFacade.saveGame(this.game, this.mode);
    this.saveInProgress = false;
  }

  onReset(): void {
    if (!this.initialGameState) return;
    this.game = JSON.parse(JSON.stringify(this.initialGameState));
    this.itemCounts = this.tileItemCountService.createRequiredCounts(this.game);
    this.tileItemCountService.adjustCountsForExistingItems(this.game, this.itemCounts);
    this.activeTileTexture = null;
    this.activeTileItem = null;
  }
}