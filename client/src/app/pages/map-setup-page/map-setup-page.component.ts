import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/interfaces/tile';
import { MAP_LARGE_SIZE, MAP_MEDIUM_SIZE, MAP_SMALL_SIZE, MOUSE_EVENT, OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/pages/map-setup-page/map-setup-page-constant';
import { CommunicationService } from '@app/services/communication.service';
import { GameValidatorService } from '@app/services/game-validator.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';


@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly communicationService = inject(CommunicationService);
  private readonly gameValidator = inject(GameValidatorService);

  game: Game;
  mode: 'create' | 'edit' = 'edit';

  activeTileTexture: TileTexture | null = null;
  activeTileItem: TileItem | null = null;

  readonly objectPlacementTools = OBJECT_PLACEMENT_TOOL;
  readonly objectPlacementToolsArray = Object.values(OBJECT_PLACEMENT_TOOL);
  readonly tileTools = Object.values(TILE_TOOLS);

  readonly TileItem = TileItem;
  readonly TileTexture = TileTexture;

  private isPaintingTiles = false;
  private isErasingTiles = false;

  spawnCount: number = 0;
  healingSanctuaryCount: number = 0;
  combatSanctuaryCount: number = 0;
  flagCount: number = 0;

  constructor() {}

  ngOnInit(): void {
    this.loadGameFromNavigation();
    this.initializeGridIfEmpty();
    this.initRequiredCount();
    this.adjustCountsForExistingItems();
  }

  private loadGameFromNavigation(): void {
    const state = history.state as { game?: Game; mode?: 'create' | 'edit' };

    if (!state?.game) {
      // Did not send a game object (did not come from our predifined path, fallback)
      this.router.navigate(['/games']);
      return;
    }

    this.game = state.game;
    this.mode = state.mode ?? 'edit';
  }

  private initializeGridIfEmpty(): void {
    // If grid is empty or doesn't match the expected size, initialize it
    if (!this.game.grid || this.game.grid.length === 0 ||
      this.game.grid.length !== this.game.size.rows ||
      this.game.grid[0]?.length !== this.game.size.cols) {
      this.game.grid = Array.from({ length: this.game.size.rows }, () =>
        Array.from({ length: this.game.size.cols }, (): Tile => ({
          type: TileTexture.Floor,
          item: null
        }))
      );
    }
  }

  getRequiredSpawnCount(): number {
    if (this.game.size.rows === MAP_SMALL_SIZE) return 2;
    if (this.game.size.rows === MAP_MEDIUM_SIZE) return 4;
    if (this.game.size.rows === MAP_LARGE_SIZE) return 6;
    throw new Error("The size selected is not currently supported (SpawnCount)");
  }

  getRequiredFlagCount(): number {
    if (this.game.gameMode === GameMode.Classic) return 0;
    if (this.game.gameMode === GameMode.Ctf) return 1;
    throw new Error("The game mode is not currently supported (GameMode)");
  }

  getRequiredHealingSanctuaryCount(): number {
    if (this.game.size.rows === MAP_SMALL_SIZE) return 1;
    if (this.game.size.rows === MAP_MEDIUM_SIZE) return 2;
    if (this.game.size.rows === MAP_LARGE_SIZE) return 4;
    throw new Error("The size selected is not currently supported (HealingSanctuary)");
  }

  getRequiredCombatSanctuaryCount(): number {
    if (this.game.size.rows === MAP_SMALL_SIZE) return 1;
    if (this.game.size.rows === MAP_MEDIUM_SIZE) return 2;
    if (this.game.size.rows === MAP_LARGE_SIZE) return 4;
    throw new Error("The size selected is not currently supported (CombatSanctuary)");
  }

  initRequiredCount(): void {
    this.spawnCount = this.getRequiredSpawnCount();
    this.healingSanctuaryCount = this.getRequiredHealingSanctuaryCount();
    this.combatSanctuaryCount = this.getRequiredCombatSanctuaryCount();
    this.flagCount = this.getRequiredFlagCount();
  }

  adjustCountsForExistingItems(): void {
    this.spawnCount -= this.countTileItem(TileItem.Spawn);
    this.healingSanctuaryCount -= this.countTileItem(TileItem.HealingSanctuary);
    this.combatSanctuaryCount -= this.countTileItem(TileItem.CombatSanctuary);
    this.flagCount -= this.countTileItem(TileItem.Flag);
  }

  countTileTexture(tileTexture: TileTexture): number {
    let count = 0;
    this.game.grid.forEach((row) =>
      count += row.filter((tile) => tile.type === tileTexture).length
    );

    return count;
  }

  countTileItem(tileItem: TileItem): number {
    let count = 0;
    this.game.grid.forEach((row) =>
      count += row.filter((tile) => tile.item === tileItem).length
    );

    return count;
  }

  getPlacedSpawnCount(): number {
    return this.countTileItem(TileItem.Spawn);
  }

  getPlacedFlagCount(): number {
    return this.countTileItem(TileItem.Flag);
  }

  getPlacedHealingSanctuaryCount(): number {
    return this.countTileItem(TileItem.HealingSanctuary);
  }

  getPlacedCombatSanctuaryCount(): number {
    return this.countTileItem(TileItem.CombatSanctuary);
  }

  isObjectTypeComplete(type: TileItem): boolean {
    const placed = this.countTileItem(type);
    switch (type) {
      case TileItem.Spawn:
        return placed >= this.getRequiredSpawnCount();
      case TileItem.Flag:
        return placed >= this.getRequiredFlagCount();
      case TileItem.HealingSanctuary:
        return placed >= this.getRequiredHealingSanctuaryCount();
      case TileItem.CombatSanctuary:
        return placed >= this.getRequiredCombatSanctuaryCount();
      default:
        return false;
    }
  }

  getObjectAt(x: number, y: number): Tile | undefined {
    return this.game.grid[x]?.[y];
  }

  selectTileTexture(type: TileTexture): void {
    this.activeTileTexture = this.activeTileTexture === type ? null : type;
    if (this.activeTileTexture != null) this.activeTileItem = null;
  }

  selectTileItem(type: TileItem): void {
    this.activeTileItem = this.activeTileItem === type ? null : type;
    if (this.activeTileItem != null) this.activeTileTexture = null;
  }

  onCellClick(rowIndex: number, colIndex: number): void {
    //  if tile texture is not null, apply tile texture
    if (this.activeTileTexture) {
      this.applyTile(rowIndex, colIndex, this.activeTileTexture);
    } // if tile item is not null, apply tile texture
    else if (this.activeTileItem) {
      this.applyTile(rowIndex, colIndex, this.activeTileItem);
    } else {
      return;
    }
  }

  onCellMouseDown(rowIndex: number, colIndex: number, event: MouseEvent): void {
    if (event.button === MOUSE_EVENT.LeftClick) {
      this.isPaintingTiles = true;
      if (this.activeTileTexture) {
        this.applyTile(rowIndex, colIndex, this.activeTileTexture);
      } else if (this.activeTileItem) {
        this.applyTile(rowIndex, colIndex, this.activeTileItem);
      }
      return;
    }

    if (event.button === MOUSE_EVENT.RightClick) {
      event.preventDefault();
      this.isErasingTiles = true;
      if (this.activeTileTexture) {
        this.deleteTile(rowIndex, colIndex, this.activeTileTexture, event);
      } else if (this.activeTileItem) {
        this.deleteTile(rowIndex, colIndex, this.activeTileItem, event);
      }
    }
  }

  onCellMouseEnter(rowIndex: number, colIndex: number, event: MouseEvent): void {
    if (this.isErasingTiles) {
      if (event.buttons !== MOUSE_EVENT.RightDrag) {
        this.isErasingTiles = false;
      } else {
        if (event.shiftKey && this.activeTileItem) {
          this.deleteTile(rowIndex, colIndex, this.activeTileItem, event);
        } else if (this.activeTileTexture) {
          this.deleteTile(rowIndex, colIndex, this.activeTileTexture, event);
        }
      }
      return;
    }

    if (!this.isPaintingTiles) return;

    if (event.buttons !== MOUSE_EVENT.LeftDrag) {
      this.isPaintingTiles = false;
      return;
    }

    const gameTile = this.game.grid[rowIndex][colIndex]

    if (this.activeTileTexture) {
      if (
        [TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(this.activeTileTexture) &&
        gameTile.item
      ) {
        const removedItem = gameTile.item;
        gameTile.item = null;
        this.increaseTileItemCount(removedItem);
      }
      this.applyTile(rowIndex, colIndex, this.activeTileTexture);
    }
  }

  onGridMouseLeave(): void {
    this.isPaintingTiles = false;
    this.isErasingTiles = false;
  }

  onDocumentMouseUp(): void {
    this.isPaintingTiles = false;
    this.isErasingTiles = false;
  }

  private verifyEnoughTileItem(item: TileItem): boolean {
    switch (item) {
      case TileItem.Spawn:
        return this.spawnCount > 0;
      case TileItem.HealingSanctuary:
        return this.healingSanctuaryCount > 0;
      case TileItem.CombatSanctuary:
        return this.combatSanctuaryCount > 0;
      case TileItem.Flag:
        return this.flagCount > 0;
      default:
        return false;
    }
  }

  private decreaseTileItemCount(item: TileItem): void {
    switch (item) {
      case TileItem.Spawn:
        this.spawnCount--;
        break;
      case TileItem.HealingSanctuary:
        this.healingSanctuaryCount--;
        break;
      case TileItem.CombatSanctuary:
        this.combatSanctuaryCount--;
        break;
      case TileItem.Flag:
        this.flagCount--;
        break;
    }
  }

  private increaseTileItemCount(item: TileItem): void {
    switch (item) {
      case TileItem.Spawn:
        this.spawnCount++;
        break;
      case TileItem.HealingSanctuary:
        this.healingSanctuaryCount++;
        break;
      case TileItem.CombatSanctuary:
        this.combatSanctuaryCount++;
        break;
      case TileItem.Flag:
        this.flagCount++;
        break;
    }
  }

  private applyTile(rowIndex: number, colIndex: number, tileAttribute: TileItem | TileTexture): void {
    const currentTile = this.game.grid[rowIndex]?.[colIndex];

    if (Object.values(TileItem).includes(tileAttribute as TileItem)) {
      if ([TileTexture.Wall, TileTexture.DoorOpened, TileTexture.DoorClosed].includes(currentTile.type))
        throw new Error("This Item cannot be place on a terrain tile");
      if (!currentTile.item && this.verifyEnoughTileItem(tileAttribute as TileItem)) {
        currentTile.item = tileAttribute as TileItem;
        this.decreaseTileItemCount(tileAttribute as TileItem);
      }
    } else {
      if (currentTile.type !== tileAttribute) {
        currentTile.type = tileAttribute as TileTexture;
      }
    }
    return;
  }

  private deleteTile(rowIndex: number, colIndex: number, tileAttribute: TileItem | TileTexture, event: MouseEvent): void {
    const currentTile = this.game.grid[rowIndex]?.[colIndex];
    const currItem = currentTile.item;

    if (currItem && Object.values(TileItem).includes(tileAttribute as TileItem) && event.shiftKey) {
      currentTile.item = null;
      this.increaseTileItemCount(currItem);
    } else {
      currentTile.type = TileTexture.Floor;
    }
  }

  onBack(): void {
    this.router.navigate(['/admin']);
  }

  onSave(): void {
    // Extract grid types for validation
    const gridTypes = this.game.grid.map(row => row.map(tile => tile.type));

    // Extract placed objects from grid
    const placedObjects = [];
    for (let row = 0; row < this.game.grid.length; row++) {
      for (let col = 0; col < this.game.grid[row].length; col++) {
        const tile = this.game.grid[row][col];
        if (tile.item) {
          placedObjects.push({
            type: tile.item,
            position: { x: col, y: row }
          });
        }
      }
    }

    const validation = this.gameValidator.validate({
      name: this.game.name,
      description: this.game.description,
      mode: this.game.gameMode,
      size: this.game.size,
      grid: gridTypes,
      placedObjects: placedObjects,
    });

    if (!validation.isValid) {
      alert(`Jeu invalide:\n- ${validation.errors.join('\n- ')}`);
      return;
    }

    const saveOperation = this.mode === 'create'
      ? this.communicationService.createGame(this.game)
      : this.communicationService.modifyGame(this.game);

    saveOperation.subscribe({
      next: () => {
        alert(`Game ${this.mode === 'create' ? 'created' : 'saved'} successfully!`);
        this.router.navigate(['/admin']);
      },
      error: (error) => {
        console.error('Error saving game:', error);
        const errorMessage = error.error || error.message || 'Unknown error';
        alert(`Error saving game: ${errorMessage}`);
      }
    });
  }

  onReset(): void {
    this.game.grid.forEach((row) => {
      row.forEach((tile) => {
        tile.type = TileTexture.Floor;
        tile.item = null;
      });
    });

    this.activeTileTexture = null;
    this.activeTileItem = null;

    this.initRequiredCount();
  }
}
