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
  // pour faire le drag des tuiles bitmas1k
  private isPaintingTiles = false;
  // pour faire le drag de suppression avec le clic droit bitmask2
  private isErasingTiles = false;

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
    {
      type: "flag",
      label: "Drapeau",
      description: "Emplacement où un joueur peut placer un drapeau.",
      image: '/assets/icons/flag.svg',
    },
    {
      type: "healingShrine",
      label: "Relique de soin",
      description: "Emplacement où un joueur peut placer une relic de soin.",
      image: '/assets/icons/healingShrine.svg',
    },
    {
      type: "combatShrine",
      label: "Relique de combat",
      description: "Emplacement où un joueur peut placer une relic de combat.",
      image: '/assets/icons/combatShrine.svg',
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
      const rows = Math.max(1, state.game.size?.rows ?? 10);
      const cols = Math.max(1, state.game.size?.cols ?? 10);
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
    // Regle projet askip , 2 4 6 selon petit moyen grand mais a revoir
    const tier = this.getMapTier();
    if (tier === 'small') return 2;
    if (tier === 'medium') return 4;
    return 6;
  }

  getPlacedSpawnCount(): number {
    return this.placedObjects.filter((o) => o.type === 'spawn').length;
  }

  getRequiredFlagCount(): number {
    return 1;
  }

  getPlacedFlagCount(): number {
    return this.placedObjects.filter((o) => o.type === 'flag').length;
  }

  getRequiredHealingShrineCount(): number {
    // Règles du projet: 1 / 2 / 4 selon taille petite/moyenne/grande
    const tier = this.getMapTier();
    if (tier === 'small') return 1;
    if (tier === 'medium') return 2;
    return 4;
  }

  getPlacedHealingShrineCount(): number {
    return this.placedObjects.filter((o) => o.type === 'healingShrine').length;
  }

  getRequiredCombatShrineCount(): number {
    // Règles du projet: 1 / 2 / 4 selon taille petite/moyenne/grande
    const tier = this.getMapTier();
    if (tier === 'small') return 1;
    if (tier === 'medium') return 2;
    return 4;
  }

  getPlacedCombatShrineCount(): number {
    return this.placedObjects.filter((o) => o.type === 'combatShrine').length;
  }

  isObjectTypeComplete(type: GameObjectType): boolean {
    if (type === 'spawn') {
      return this.getPlacedSpawnCount() >= this.getRequiredSpawnCount();
    }
    if (type === 'flag') {
      return this.getPlacedFlagCount() >= this.getRequiredFlagCount();
    }
    if (type === 'healingShrine') {
      return this.getPlacedHealingShrineCount() >= this.getRequiredHealingShrineCount();
    }
    if (type === 'combatShrine') {
      return this.getPlacedCombatShrineCount() >= this.getRequiredCombatShrineCount();
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

  private getMapTier(): 'small' | 'medium' | 'large' {
    const rows = this.grid.length || this.gridRows;
    const cols = this.grid[0]?.length ?? this.gridCols;
    const maxDim = Math.max(rows, cols);
    if (maxDim <= 10) return 'small';
    if (maxDim <= 15) return 'medium';
    return 'large';
  }

  private isTerrainTile(type: TileType): boolean {
    return type === 'floor' || type === 'water' || type === 'ice';
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
      // Objets uniquement sur tuiles de terrain
      const tileType = this.grid[rowIndex]?.[colIndex]?.type;
      if (tileType == null || !this.isTerrainTile(tileType)) return;

      const existing = this.getObjectAt(colIndex, rowIndex);
      if (existing?.type === this.activeObjectTool) {
        this.placedObjects = this.placedObjects.filter(
          (o) => !(o.position.x === colIndex && o.position.y === rowIndex),
        );

        return;
      }

      // Ne pas placer sur une case déjà occupée par un autre objet
      if (existing != null && existing.type !== this.activeObjectTool) return;

      if (this.activeObjectTool === 'spawn') {
        const placed = this.getPlacedSpawnCount();
        const required = this.getRequiredSpawnCount();
        if (placed >= required) return;
        this.placedObjects = [...this.placedObjects, { type: 'spawn', position: { x: colIndex, y: rowIndex } }];
        return;
      }

      if (this.activeObjectTool === 'flag') {
        // 1 seule instance: si déjà placée ailleurs, on la déplace
        this.placedObjects = [
          ...this.placedObjects.filter((o) => o.type !== 'flag'),
          { type: 'flag', position: { x: colIndex, y: rowIndex } },
        ];
        return;
      }

      if (this.activeObjectTool === 'healingShrine') {
        const placed = this.getPlacedHealingShrineCount();
        const required = this.getRequiredHealingShrineCount();
        if (placed >= required) return;
        this.placedObjects = [...this.placedObjects, { type: 'healingShrine', position: { x: colIndex, y: rowIndex } }];
        return;
      }

      if (this.activeObjectTool === 'combatShrine') {
        const placed = this.getPlacedCombatShrineCount();
        const required = this.getRequiredCombatShrineCount();
        if (placed >= required) return;
        this.placedObjects = [...this.placedObjects, { type: 'combatShrine', position: { x: colIndex, y: rowIndex } }];
        return;
      }

      return;
    }
    if (this.activeTool != null) {
      this.applyTileIfDifferent(rowIndex, colIndex);
    }
  }

  onCellMouseDown(rowIndex: number, colIndex: number, event: MouseEvent): void {
    if (event.button === 0) {
      if (this.activeTool == null || this.activeObjectTool != null) return;
      this.isPaintingTiles = true;
      this.applyTileIfDifferent(rowIndex, colIndex);
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      this.isErasingTiles = true;
      this.eraseTileToBase(rowIndex, colIndex);
    }
  }

  onCellMouseEnter(rowIndex: number, colIndex: number, event: MouseEvent): void {
    if (this.isErasingTiles) {
      // bitmask 2 = bouton droit enfonce
      if ((event.buttons & 2) !== 2) {
        this.isErasingTiles = false;
        return;
      }
      this.eraseTileToBase(rowIndex, colIndex);
      return;
    }

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
    this.isErasingTiles = false;
  }

  //POur si le user relache la souris hors de la grille
  onDocumentMouseUp(): void {
    this.isPaintingTiles = false;
    this.isErasingTiles = false;
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

  private eraseTileToBase(rowIndex: number, colIndex: number): void {
    const current = this.grid[rowIndex]?.[colIndex];
    if (!current) return;

    if (current.type === 'floor') return;

    this.grid[rowIndex][colIndex] = {
      ...current,
      type: 'floor',
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
