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

const DIMENSIONS_DEBOUNCE_MS = 150;

@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent {
  private readonly router = inject(Router);

  private dimensionsDebounceId: ReturnType<typeof setTimeout> | null = null;

  gameName = '';
  gameDescription = '';

  gameType: 'Solo' | 'Co-op' = 'Solo';

  gridRows = 10;
  gridCols = 10;

  grid: Tile[][] = this.createGrid(this.gridRows, this.gridCols, 'floor');

  placedObjects: PlacedObject[] = [];

  activeTool: ApplicableTileType | null = null;

  activeObjectTool: GameObjectType | null = null;

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
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as {
      game?: GameCard & { grid?: string; objects?: string };
      grid?: string;
      objects?: string;
    } | undefined;
    if (state?.game) {
      this.gameName = state.game.name;
      const modeStr = state.game.mode?.trim();
      if (modeStr === 'Co-op' || modeStr === 'Solo') {
        this.gameType = modeStr;
      }
      const [rows, cols] = this.parseSize(state.game.size);
      this.gridRows = rows;
      this.gridCols = cols;
      const gridJson = state.grid ?? state.game.grid;
      if (gridJson) {
        try {
          const parsed = JSON.parse(gridJson) as Tile[][];
          if (Array.isArray(parsed) && parsed.length === rows && parsed[0]?.length === cols) {
            this.grid = parsed;
          } else {
            this.grid = this.createGrid(rows, cols, 'floor');
          }
        } catch {
          this.grid = this.createGrid(rows, cols, 'floor');
        }
      } else {
        this.grid = this.createGrid(rows, cols, 'floor');
      }
      const objectsJson = state.objects ?? (state.game as { objects?: string })?.objects;
      if (objectsJson) {
        try {
          const parsed = JSON.parse(objectsJson) as PlacedObject[];
          if (Array.isArray(parsed)) {
            this.placedObjects = parsed.filter(
              (obj) => obj.position && obj.position.x >= 0 && obj.position.x < cols && obj.position.y >= 0 && obj.position.y < rows,
            );
          }
        } catch {
          this.placedObjects = [];
        }
      }
    }
  }

  getRequiredSpawnCount(): number {
    const rows = this.grid.length;
    const cols = this.grid[0]?.length ?? 0;
    return Math.max(1, Math.min(8, Math.floor((rows * cols) / 25)));
  }

  getPlacedSpawnCount(): number {
    return this.placedObjects.filter((o) => o.type === 'spawn').length;
  }

  isObjectTypeComplete(type: GameObjectType): boolean {
    if (type === 'spawn') {
      return this.getPlacedSpawnCount() >= this.getRequiredSpawnCount();
    }
    return false;
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
    const match = size.trim().toUpperCase().match(/^(\d+)\s*X\s*(\d+)$/);
    if (match) {
      const r = Math.max(1, parseInt(match[1], 10));
      const c = Math.max(1, parseInt(match[2], 10));
      return [r, c];
    }
    return [10, 10];
  }

  private createGrid(rows: number, cols: number, type: TileType): Tile[][] {
    return Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) => ({
        position: { x, y },
        type,
      })),
    );
  }

  onDimensionsChange(): void {
    if (this.dimensionsDebounceId != null) {
      clearTimeout(this.dimensionsDebounceId);
    }
    this.dimensionsDebounceId = setTimeout(() => {
      this.dimensionsDebounceId = null;
      const rows = Math.max(1, Math.min(50, Number(this.gridRows) || 10));
      const cols = Math.max(1, Math.min(50, Number(this.gridCols) || 10));
      if (rows === this.grid.length && cols === (this.grid[0]?.length ?? 0)) return;
      requestAnimationFrame(() => {
        this.gridRows = rows;
        this.gridCols = cols;
        const newGrid = this.createGrid(rows, cols, 'floor');
        for (let y = 0; y < Math.min(rows, this.grid.length); y++) {
          for (let x = 0; x < Math.min(cols, this.grid[0]?.length ?? 0); x++) {
            newGrid[y][x] = { ...this.grid[y][x], position: { x, y } };
          }
        }
        this.grid = newGrid;
        this.placedObjects = this.placedObjects.filter(
          (o) => o.position.x < cols && o.position.y < rows,
        );
      });
    }, DIMENSIONS_DEBOUNCE_MS);
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
      } else if (this.activeObjectTool === 'spawn') {
        const placed = this.getPlacedSpawnCount();
        const required = this.getRequiredSpawnCount();
        if (placed < required) {
          this.placedObjects = this.placedObjects.filter(
            (o) => !(o.position.x === colIndex && o.position.y === rowIndex),
          );
          this.placedObjects = [
            ...this.placedObjects,
            { type: 'spawn', position: { x: colIndex, y: rowIndex } },
          ];
        }
      }
      return;
    }
    if (this.activeTool != null) {
      this.grid[rowIndex][colIndex] = {
        ...this.grid[rowIndex][colIndex],
        type: this.activeTool,
      };
    }
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
