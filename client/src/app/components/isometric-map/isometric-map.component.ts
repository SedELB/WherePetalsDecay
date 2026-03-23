import { AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges, ViewChild } from '@angular/core';
import { Tile } from '@common/tile';

const TILE_W = 64;
const TILE_H = 32;
const THICKNESS = 12; // Adds depth to tiles

@Component({
  selector: 'app-isometric-map',
  imports: [],
  templateUrl: './isometric-map.component.html',
  styleUrl: './isometric-map.component.scss',
})
export class IsometricMapComponent implements OnChanges, AfterViewInit {
  @ViewChild('isoCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() grid: Tile[][] = [];

  ngOnChanges(): void {
    this.render();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.render(), 0);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.render();
  }

  private render(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.grid || !this.grid.length) return;

    const rect = canvas.getBoundingClientRect();
    const rows = this.grid.length;
    const cols = this.grid[0].length;

    const baseMapWidth = (cols + rows) * (TILE_W / 2);
    const baseMapHeight = (cols + rows) * (TILE_H / 2) + THICKNESS;

    const padding = 40;
    const scale = (rect.width - padding) / baseMapWidth;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr * scale, dpr * scale);

    const originX = (rect.width / scale) / 2 - ((cols - rows) * (TILE_W / 4));
    const originY = (rect.height / scale) / 2 + (TILE_H / 2) - (baseMapHeight / 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const screen = this.toIso(col, row);
        this.drawTile(ctx, screen.x + originX, screen.y + originY);
      }
    }
  }

  private toIso(gridX: number, gridY: number): { x: number, y: number } {
    return {
      x: (gridX - gridY) * (TILE_W / 2),
      y: (gridX + gridY) * (TILE_H / 2),
    };
  }

  private drawTile(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineJoin = 'round';

    // Left
    ctx.beginPath();
    ctx.moveTo(centerX - TILE_W / 2, centerY);
    ctx.lineTo(centerX, centerY + TILE_H / 2);
    ctx.lineTo(centerX, centerY + TILE_H / 2 + THICKNESS);
    ctx.lineTo(centerX - TILE_W / 2, centerY + THICKNESS);
    ctx.closePath();
    ctx.fillStyle = '#657e8c';
    ctx.fill();
    ctx.stroke();

    // Right
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + TILE_H / 2);
    ctx.lineTo(centerX + TILE_W / 2, centerY);
    ctx.lineTo(centerX + TILE_W / 2, centerY + THICKNESS);
    ctx.lineTo(centerX, centerY + TILE_H / 2 + THICKNESS);
    ctx.closePath();
    ctx.fillStyle = '#506573';
    ctx.fill();
    ctx.stroke();

    // Top
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - TILE_H / 2);
    ctx.lineTo(centerX + TILE_W / 2, centerY);
    ctx.lineTo(centerX, centerY + TILE_H / 2);
    ctx.lineTo(centerX - TILE_W / 2, centerY);
    ctx.closePath();
    ctx.fillStyle = '#83a0b5';
    ctx.fill();
    ctx.stroke();
  }
}
