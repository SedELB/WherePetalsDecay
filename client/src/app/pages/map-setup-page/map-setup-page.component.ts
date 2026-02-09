import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/pages/map-setup-page/map-setup-page-constant';
import { MapSetupFacadeService } from '@app/services/map-setup-facade.service';
import { MapSetupService } from '@app/services/map-setup.service';
import { TileItemCounts } from '@app/services/map-setup.types';
import { TileItemCountService } from '@app/services/tile-item-count.service';
import { TileItem, TileTexture } from '@common/enums';

@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent implements OnInit {
  private readonly mapSetupFacade = inject(MapSetupFacadeService);
  private readonly mapSetupService = inject(MapSetupService);
  private readonly tileItemCountService = inject(TileItemCountService);

  game: Game;
  mode: 'create' | 'edit' = 'edit';

  activeTileTexture: TileTexture | null = null;
  activeTileItem: TileItem | null = null;

  readonly objectPlacementTools = OBJECT_PLACEMENT_TOOL;
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
    healingSanctuaryCount: 0,
    combatSanctuaryCount: 0,
    flagCount: 0,
  };

  ngOnInit(): void {
    const init = this.mapSetupFacade.initializeFromNavigation();
    this.game = init.game;
    this.mode = init.mode;
    this.itemCounts = init.itemCounts;
  }

  getRequiredSpawnCount(): number {
    return this.tileItemCountService.getRequiredSpawnCount(this.game);
  }

  getRequiredFlagCount(): number {
    return this.tileItemCountService.getRequiredFlagCount(this.game);
  }

  getRequiredHealingSanctuaryCount(): number {
    return this.tileItemCountService.getRequiredHealingSanctuaryCount(this.game);
  }

  getRequiredCombatSanctuaryCount(): number {
    return this.tileItemCountService.getRequiredCombatSanctuaryCount(this.game);
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

  getPlacedHealingSanctuaryCount(): number {
    return this.tileItemCountService.getPlacedHealingSanctuaryCount(this.game);
  }

  getPlacedCombatSanctuaryCount(): number {
    return this.tileItemCountService.getPlacedCombatSanctuaryCount(this.game);
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
    await this.mapSetupFacade.saveGame(this.game, this.mode);
  }

  onReset(): void {
    const resetResult = this.mapSetupService.resetMap(this.game);
    this.itemCounts = resetResult.itemCounts;
    this.activeTileTexture = resetResult.selection.activeTileTexture;
    this.activeTileItem = resetResult.selection.activeTileItem;
  }
}
