import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@app/interfaces/game';
import { Tile, TileType } from '@app/interfaces/tile';

@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, RouterLink, ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent {
  private readonly router = inject(Router);

  gameName = '';
  gameDescription = '';

  // Pour l'instant on fait des 10x10 mais normalement le user peut choisir la taille
  gridRows = 10;
  gridCols = 10;

  grid: Tile[][] = this.createGrid(this.gridRows, this.gridCols, 'floor');

  private createGrid(rows: number, cols: number, type: TileType): Tile[][] {
    return Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) => ({
        position: { x, y },
        type,
      })),
    );
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
      grid: this.grid,
      objects: [],
      lastModifiedIso: new Date().toISOString(),
    };

    console.log('Game à sauvegarder:', gameToSave);
  }
  onReset(): void {
    this.gameName = '';
    this.gameDescription = '';
    this.grid = this.createGrid(this.gridRows, this.gridCols, 'floor');
  }
}
