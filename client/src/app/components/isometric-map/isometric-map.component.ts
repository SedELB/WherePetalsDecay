import { AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, ViewChild, Output, EventEmitter } from '@angular/core';
import { Vec2 } from '@common/vec2';
import { Tile } from '@common/tile';
import { Player } from '@common/player';
import { IsometricViewService } from '@app/services/isometric-view/isometric-view.service';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_SPEED, MIN_TILE_W, TILE_RATIO, TILE_THICKNESS } from '@app/constants/isometric.constants';
import { ActionTileHighlight } from '@app/interfaces/isometric-interfaces';

@Component({
  selector: 'app-isometric-map',
  standalone: true,
  imports: [],
  templateUrl: './isometric-map.component.html',
  styleUrl: './isometric-map.component.scss',
})
export class IsometricMapComponent implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('isoCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() grid: Tile[][] = [];
  @Input() players: Player[] = [];
  @Input() playerPositions: Record<string, Vec2> = {};
  @Input() reachableTiles: Vec2[] = [];
  @Input() teleportableTiles: Vec2[] = [];
  @Input() actionHighlightTiles: ActionTileHighlight[] = [];
  @Input() localPlayerSocketId?: string;
  @Input() isLocalPlayerTurn: boolean = false;
  @Input() inactiveSanctuaries: Vec2[] = [];
  @Input() isCTF: boolean = false;
  @Input() teamA: Player[] = [];
  @Input() teamB: Player[] = [];

  @Output() tileClick = new EventEmitter<Vec2>();
  @Output() rightClick = new EventEmitter<{event: MouseEvent, pos: Vec2}>();


  // Camera state
  private cameraX = 0;
  private cameraY = 0;
  private zoom = 1;
  private needsRecenter = true;

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  // Animation and Cache
  private animationFrameId = 0;

  // Bound event handlers (for cleanup)
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnWheel = this.onWheel.bind(this);
  private boundOnClick = this.onClick.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);


  constructor(private isometricViewService: IsometricViewService) {}

  ngOnChanges(): void {
    this.needsRecenter = false;
    this.render();
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.needsRecenter = true;
    canvas.addEventListener('mousedown', this.boundOnMouseDown);
    canvas.addEventListener('mousemove', this.boundOnMouseMove);
    canvas.addEventListener('mouseup', this.boundOnMouseUp);
    canvas.addEventListener('mouseleave', this.boundOnMouseUp);
    canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
    canvas.addEventListener('click', this.boundOnClick);
    canvas.addEventListener('contextmenu', this.boundOnContextMenu);


    // main loop at 60 fps
    const loop = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    const canvas = this.canvasRef.nativeElement;
    canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    canvas.removeEventListener('mousemove', this.boundOnMouseMove);
    canvas.removeEventListener('mouseup', this.boundOnMouseUp);
    canvas.removeEventListener('mouseleave', this.boundOnMouseUp);
    canvas.removeEventListener('wheel', this.boundOnWheel);
    canvas.removeEventListener('click', this.boundOnClick);
    canvas.removeEventListener('contextmenu', this.boundOnContextMenu);

  }

  @HostListener('window:resize')
  onResize(): void {
    this.render();
  }

  private onMouseDown(e: MouseEvent): void {
    // Only pan on left click (button 0), ignore right-click
    if (e.button !== 0) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.cameraStartX = this.cameraX;
    this.cameraStartY = this.cameraY;
    this.canvasRef.nativeElement.style.cursor = 'grabbing';
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.cameraX = this.cameraStartX + dx / this.zoom;
      this.cameraY = this.cameraStartY + dy / this.zoom;
      this.render();
      return;
    }
    
    const pos = this.getOriginalGridPosition(e);
    const isActionTarget = pos !== null &&
      this.actionHighlightTiles.some(h => h.pos.x === pos.x && h.pos.y === pos.y);
    this.canvasRef.nativeElement.style.cursor = isActionTarget ? 'pointer' : 'default';
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.canvasRef.nativeElement.style.cursor = 'default';
  }

  private getOriginalGridPosition(e: MouseEvent): Vec2 | null {
    if (!this.grid || !this.grid.length || !this.grid[0].length) return null;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const relX = (mouseX - rect.width / 2) / this.zoom - this.cameraX + rect.width / 2;
    const relY = (mouseY - rect.height / 2) / this.zoom - this.cameraY + rect.height / 2;

    const totalRows = this.grid.length;
    const totalColumns = this.grid[0].length;
    const width = rect.width;
    const height = rect.height;

    const fitTileW = (2 * width) / (totalColumns + totalRows);
    const tileW = Math.max(fitTileW, MIN_TILE_W);
    const tileH = tileW / TILE_RATIO;
    const diamondHeight = (totalColumns + totalRows) * (tileH / 2);
    const originX = width / 2;
    const originY = (height - TILE_THICKNESS) / 2 - diamondHeight / 2;

    const dx = relX - originX;
    const dy = relY - originY;
    const halfW = tileW / 2;
    const halfH = tileH / 2;

    const col = Math.floor((dx / halfW + dy / halfH) / 2);
    const row = Math.floor((dy / halfH - dx / halfW) / 2);

    if (col >= 0 && col < totalColumns && row >= 0 && row < totalRows) {
      return { x: col, y: row };
    }
    return null;
  }

  private onClick(e: MouseEvent): void {
    const pos = this.getOriginalGridPosition(e);
    if (pos) {
      this.tileClick.emit(pos);
    }
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const pos = this.getOriginalGridPosition(e);
    if (pos) {
      this.rightClick.emit({ event: e, pos });
    }
  }


  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    // Mouse position relative to canvas center
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const oldZoom = this.zoom;
    const zoomDelta = -e.deltaY * ZOOM_SPEED;
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * (1 + zoomDelta)));

    // Zoom towards cursor position
    const zoomRatio = this.zoom / oldZoom;
    this.cameraX -= (mouseX / oldZoom) * (1 - 1 / zoomRatio);
    this.cameraY -= (mouseY / oldZoom) * (1 - 1 / zoomRatio);

    this.render();
  }

  private render(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    this.isometricViewService.renderBoard({
      ctx,
      width: rect.width,
      height: rect.height,
      grid: this.grid,
      players: this.players,
      playerPositions: this.playerPositions,
      camera: { x: this.cameraX, y: this.cameraY, zoom: this.zoom },
      needsRecenter: this.needsRecenter,
      reachableTiles: this.reachableTiles,
      teleportableTiles: this.teleportableTiles,
      actionHighlightTiles: this.actionHighlightTiles,
      localPlayerSocketId: this.localPlayerSocketId,
      isLocalPlayerTurn: this.isLocalPlayerTurn,
      inactiveSanctuaries: this.inactiveSanctuaries,
      isCTF: this.isCTF,
      teamA: this.teamA,
      teamB: this.teamB,
      onRecenter: (zoom, x, y) => {
        this.zoom = zoom;
        this.cameraX = x;
        this.cameraY = y;
        this.needsRecenter = false;
        canvas.style.cursor = 'default';
      },
    });
  }
}