import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game, GameCard, GameObjectType, PlacedObject } from '@app/interfaces/game';
import { Tile, TileType } from '@app/interfaces/tile';

type ApplicableTileType = 'wall' | 'water' | 'ice';

interface TileTool {
  type: ApplicableTileType;
  label: string;
  description: string;
}

interface ObjectPlacementTool {
  type: GameObjectType;
  label: string;
  description: string;
  image: string;
}

@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent {
  private readonly router = inject(Router);

  gameName = '';
  gameDescription = '';

  gameType: 'Solo' | 'Co-op' = 'Solo';

  gridRows = 10;
  gridCols = 10;

  grid: Tile[][] = this.createGrid(this.gridRows, this.gridCols, 'floor');

  placedObjects: PlacedObject[] = [];

  activeTool: ApplicableTileType | null = null;

  activeObjectTool: GameObjectType | null = null;
  // pour faire le drag des tuiles
  private isPaintingTiles = false;

  readonly tileTools: TileTool[] = [
    { type: 'wall', label: 'Mur', description: 'Bloque le passage des joueurs.' },
    { type: 'water', label: 'Eau', description: 'Zone liquide, ralentit ou bloque selon les règles.' },
    { type: 'ice', label: 'Glace', description: 'Surface glissante qui modifie les déplacements.' },
  ];

  readonly objectPlacementTools: ObjectPlacementTool[] = [
    {
      type: 'spawn',
      label: 'Point de départ',
      description: 'Emplacement où un joueur apparaît au début de la partie.',
      image: '/assets/icons/spawn.svg',
    },
  ];

  constructor() {
    this.loadGameFromNavigation();
  }

  private loadGameFromNavigation(): void {
    const state = this.router.getCurrentNavigation()?.extras?.state as {
      game?: GameCard & { grid?: string; objects?: string };
    } | undefined;

    if (!state?.game) return;

    this.gameName = state.game.name;
    if (state.game.mode === 'Co-op' || state.game.mode === 'Solo') {
      this.gameType = state.game.mode;
    }

    const [rows, cols] = this.parseSize(state.game.size);
    this.gridRows = rows;
    this.gridCols = cols;

    this.grid = this.parseGrid(state.game.grid, rows, cols);
    this.placedObjects = this.parseObjects(state.game.objects);
  }

  private parseGrid(json: string | undefined, rows: number, cols: number): Tile[][] {
    try {
      return json ? JSON.parse(json) : this.createGrid(rows, cols, 'floor');
    } catch {
      return this.createGrid(rows, cols, 'floor');
    }
  }

  private parseObjects(json: string | undefined): PlacedObject[] {
    try {
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  getRequiredSpawnCount(): number {
    const rows = this.grid.length;
    const cols = this.grid[0].length;
    return Math.max(1, Math.min(8, Math.floor((rows * cols) / 25)));
  }

  getPlacedSpawnCount(): number {
    return this.placedObjects.filter((o) => o.type === 'spawn').length;
  }

  isObjectTypeComplete(type: GameObjectType): boolean {
    return type === 'spawn' && this.getPlacedSpawnCount() >= this.getRequiredSpawnCount();
  }

  getObjectToolDescription(type: GameObjectType): string {
    return this.objectPlacementTools.find((t) => t.type === type)?.description ?? '';
  }

  getObjectToolImage(type: GameObjectType): string {
    return this.objectPlacementTools.find((t) => t.type === type)?.image ?? '';
  }

  getObjectAt(x: number, y: number): PlacedObject | undefined {
    return this.placedObjects.find((o) => o.position.x === x && o.position.y === y);
  }

  private parseSize(size: string): [number, number] {
    const [r, c] = size.split('X').map(Number);
    return [r || 10, c || 10];
  }

  private createGrid(rows: number, cols: number, type: TileType): Tile[][] {
    return Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) => ({
        position: { x, y },
        type,
      })),
    );
  }

  applyDimensions(): void {
    const rows = Math.max(1, Math.min(50, Number(this.gridRows)));
    const cols = Math.max(1, Math.min(50, Number(this.gridCols)));
    this.gridRows = rows;
    this.gridCols = cols;
    if (rows === this.grid.length && cols === this.grid[0]?.length) return;
    const oldRows = this.grid.length;
    const oldCols = this.grid[0]?.length ?? 0;
    const newGrid = this.createGrid(rows, cols, 'floor');
    for (let y = 0; y < Math.min(rows, oldRows); y++) {
      for (let x = 0; x < Math.min(cols, oldCols); x++) {
        newGrid[y][x] = this.grid[y][x];
      }
    }
    this.grid = newGrid;
    this.placedObjects = this.placedObjects.filter(
      (o) => o.position.x < cols && o.position.y < rows,
    );
  }

  selectTool(type: ApplicableTileType): void {
    this.activeTool = this.activeTool === type ? null : type;
    if (this.activeTool != null) this.activeObjectTool = null;
  }

  selectObjectTool(type: GameObjectType): void {
    this.activeObjectTool = this.activeObjectTool === type ? null : type;
    if (this.activeObjectTool != null) this.activeTool = null;
  }

  onCellClick(rowIndex: number, colIndex: number): void {
    if (this.activeObjectTool != null) {
      const existing = this.getObjectAt(colIndex, rowIndex);
      if (existing?.type === this.activeObjectTool) {
        this.placedObjects = this.placedObjects.filter(
          (o) => !(o.position.x === colIndex && o.position.y === rowIndex),
        );
      } else if (this.activeObjectTool === 'spawn' && this.getPlacedSpawnCount() < this.getRequiredSpawnCount()) {
        this.placedObjects = [
          ...this.placedObjects.filter((o) => !(o.position.x === colIndex && o.position.y === rowIndex)),
          { type: 'spawn', position: { x: colIndex, y: rowIndex } },
        ];
      }
      return;
    }
    if (this.activeTool != null) {
      this.applyTileIfDifferent(rowIndex, colIndex);
    }
  }

  onCellMouseDown(rowIndex: number, colIndex: number, event: MouseEvent): void {
    // seulement bouton gauche
    if (event.button !== 0) return;

    // drag uniquement pour les outils de tuiles (pas les objets)
    if (this.activeTool == null || this.activeObjectTool != null) return;

    this.isPaintingTiles = true;
    this.applyTileIfDifferent(rowIndex, colIndex);
  }

  onCellMouseEnter(rowIndex: number, colIndex: number, event: MouseEvent): void {
    if (!this.isPaintingTiles) return;

    // Securite au cas ou , en gros , event.buttons c'est un bitmask et lorsque le bouton gauche est enfonce sa retourne 1 
    if ((event.buttons & 1) !== 1) {
      this.isPaintingTiles = false;
      return;
    }

    if (this.activeTool == null || this.activeObjectTool != null) return;
    this.applyTileIfDifferent(rowIndex, colIndex);
  }

  onGridMouseLeave(): void {
    this.isPaintingTiles = false;
  }

  //POur si le user relache la souris hors de la grille
  onDocumentMouseUp(): void {
    this.isPaintingTiles = false;
  }

  private applyTileIfDifferent(rowIndex: number, colIndex: number): void {
    const current = this.grid[rowIndex]?.[colIndex];
    if (!current || this.activeTool == null) return;
    if (current.type === this.activeTool) return;

    this.grid[rowIndex][colIndex] = {
      ...current,
      type: this.activeTool,
    };
  }

  onBack(): void {
    this.router.navigate(['/admin']);
  }

  onSave(): void {
    const gameToSave: Game = {
      name: this.gameName,
      description: this.gameDescription,
      mode: 'classic',
      size: { rows: this.gridRows, cols: this.gridCols },
      grid: JSON.stringify(this.grid),
      objects: JSON.stringify(this.placedObjects),
      lastModifiedIso: new Date().toISOString(),
    };
    console.log('Game à sauvegarder:', gameToSave, 'type:', this.gameType);
  }

  onReset(): void {
    this.gameName = '';
    this.gameDescription = '';
    this.gameType = 'Solo';
    this.grid = this.createGrid(this.gridRows, this.gridCols, 'floor');
    this.placedObjects = [];
    this.activeTool = null;
    this.activeObjectTool = null;
  }
}
