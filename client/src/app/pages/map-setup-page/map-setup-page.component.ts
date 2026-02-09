import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/pages/map-setup-page/map-setup-page-constant';
import { MapSetupFacadeService } from '@app/services/map-setup-facade.service';
import { MapSetupService, TileItemCounts } from '@app/services/map-setup.service';
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

  game: Game;
  mode: 'create' | 'edit' = 'edit';

  activeTileTexture: TileTexture | null = null;
  activeTileItem: TileItem | null = null;

  readonly objectPlacementTools = OBJECT_PLACEMENT_TOOL;
  readonly objectPlacementToolsArray = Object.values(OBJECT_PLACEMENT_TOOL);
  readonly tileTools = Object.values(TILE_TOOLS).filter(
    (tool) => ![TileTexture.Floor, TileTexture.DoorOpened].includes(tool.type)
  );

  readonly TileItem = TileItem;
  readonly TileTexture = TileTexture;

  private isPaintingTiles = false;
  private isErasingTiles = false;

  private itemCounts: TileItemCounts = {
    spawnCount: 0,
    healingSanctuaryCount: 0,
    combatSanctuaryCount: 0,
    flagCount: 0,
  };

  constructor() {}

  ngOnInit(): void {
    const init = this.mapSetupFacade.initializeFromNavigation();
    this.game = init.game;
    this.mode = init.mode;
    this.itemCounts = init.itemCounts;
  }

  getRequiredSpawnCount(): number {
    return this.mapSetupService.getRequiredSpawnCount(this.game);
  }

  getRequiredFlagCount(): number {
    return this.mapSetupService.getRequiredFlagCount(this.game);
  }

  getRequiredHealingSanctuaryCount(): number {
    return this.mapSetupService.getRequiredHealingSanctuaryCount(this.game);
  }

  getRequiredCombatSanctuaryCount(): number {
    return this.mapSetupService.getRequiredCombatSanctuaryCount(this.game);
  }

  countTileTexture(tileTexture: TileTexture): number {
    return this.mapSetupService.countTileTexture(this.game, tileTexture);
  }

  countTileItem(tileItem: TileItem): number {
    return this.mapSetupService.countTileItem(this.game, tileItem);
  }

  getPlacedSpawnCount(): number {
    return this.mapSetupService.getPlacedSpawnCount(this.game);
  }

  getPlacedFlagCount(): number {
    return this.mapSetupService.getPlacedFlagCount(this.game);
  }

  getPlacedHealingSanctuaryCount(): number {
    return this.mapSetupService.getPlacedHealingSanctuaryCount(this.game);
  }

  getPlacedCombatSanctuaryCount(): number {
    return this.mapSetupService.getPlacedCombatSanctuaryCount(this.game);
  }

  isObjectTypeComplete(type: TileItem): boolean {
    return this.mapSetupService.isObjectTypeComplete(this.game, type);
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

  onCellClick(rowIndex: number, colIndex: number): void {
    this.mapSetupService.applyActiveSelection(
      this.game,
      rowIndex,
      colIndex,
      this.activeTileTexture,
      this.activeTileItem,
      this.itemCounts
    );
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
