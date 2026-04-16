import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { MAX_ZOOM, MIN_TILE_W, MIN_ZOOM, TILE_RATIO, TILE_THICKNESS, ZOOM_SPEED } from '@app/constants/isometric.constants';
import { ActionTileHighlight } from '@app/interfaces/isometric-interfaces';
import { IsometricViewService } from '@app/services/isometric-view/isometric-view.service';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';

const PLAYER_MOVE_BASE_DURATION_MS = 180;
const PLAYER_MOVE_MIN_DURATION_MS = 120;
const PLAYER_MOVE_MAX_DURATION_MS = 260;
const PLAYER_TELEPORT_SNAP_DISTANCE = 1.5;
const PLAYER_POSITION_EPSILON = 0.001;
const EASE_IN_OUT_SWITCH_POINT = 0.5;
const EASE_ACCELERATION_FACTOR = 4;
const EASE_DECELERATION_FACTOR = -2;
const EASE_POWER = 3;
const EASE_DECELERATION_OFFSET = 2;
const EASE_DECELERATION_DIVISOR = 2;

interface PlayerMotionState {
  from: Vec2;
  to: Vec2;
  startTimeMs: number;
  durationMs: number;
}

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
  @Input() playerStartPositions: Record<string, Vec2> = {};
  @Input() reachableTiles: Vec2[] = [];
  @Input() teleportableTiles: Vec2[] = [];
  @Input() actionHighlightTiles: ActionTileHighlight[] = [];
  @Input() localPlayerSocketId?: string;
  @Input() isLocalPlayerTurn: boolean = false;
  @Input() inactiveSanctuaries: Vec2[] = [];
  @Input() isCTF: boolean = false;
  @Input() teamA: Player[] = [];
  @Input() teamB: Player[] = [];
  @Input() showDirectionalKeys: boolean = true;
  @Input() pressedDirectionKey: 'W' | 'A' | 'S' | 'D' | null = null;
  @Input() playerFlipXMap?: Record<string, boolean>;
  @Input() lockCamera: boolean = false;

  @Output() tileClick = new EventEmitter<Vec2>();
  @Output() rightClick = new EventEmitter<{ event: MouseEvent, pos: Vec2 }>();


  // Camera state
  private cameraX = 0;
  private cameraY = 0;
  private zoom = 1;
  private needsRecenter = true;

  // Flip State
  private computedFlipXMap: Record<string, boolean> = {};

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  // Animation and Cache
  private animationFrameId = 0;
  private playerMotionStates = new Map<string, PlayerMotionState>();
  private animatedPlayerPositions: Record<string, Vec2> = {};

  // Bound event handlers (for cleanup)
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnWheel = this.onWheel.bind(this);
  private boundOnClick = this.onClick.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);


  constructor(private isometricViewService: IsometricViewService) {}

  ngOnChanges(): void {
    const frameTimestampMs = performance.now();
    this.syncPlayerMotionStates(frameTimestampMs);
    this.updateAnimatedPlayerPositions(frameTimestampMs);
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

    const frameTimestampMs = performance.now();
    this.syncPlayerMotionStates(frameTimestampMs);
    this.updateAnimatedPlayerPositions(frameTimestampMs);


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
    this.playerMotionStates.clear();
    this.animatedPlayerPositions = {};

  }

  private syncPlayerMotionStates(frameTimestampMs: number): void {
    const incomingSocketIds = new Set(Object.keys(this.playerPositions));

    for (const [socketId, targetPosition] of Object.entries(this.playerPositions)) {
      const existingMotionState = this.playerMotionStates.get(socketId);
      if (!existingMotionState) {
        this.playerMotionStates.set(socketId, {
          from: { ...targetPosition },
          to: { ...targetPosition },
          startTimeMs: frameTimestampMs,
          durationMs: 0,
        });
        continue;
      }

      if (this.arePositionsClose(existingMotionState.to, targetPosition)) continue;

      const currentPosition = this.getMotionPosition(existingMotionState, frameTimestampMs);
      const distance = this.getDistance(currentPosition, targetPosition);
      const shouldSmooth = this.shouldSmoothMovement(currentPosition, targetPosition, distance);

      const deltaX = targetPosition.x - currentPosition.x;
      const deltaY = targetPosition.y - currentPosition.y;

      if (deltaX < -PLAYER_POSITION_EPSILON) {
        this.computedFlipXMap[socketId] = false;
      } else if (deltaX > PLAYER_POSITION_EPSILON) {
        this.computedFlipXMap[socketId] = true;
      } else if (deltaY < -PLAYER_POSITION_EPSILON) {
        // W: same facing as D
        this.computedFlipXMap[socketId] = true;
      } else if (deltaY > PLAYER_POSITION_EPSILON) {
        // S: same facing as A
        this.computedFlipXMap[socketId] = false;
      }

      this.playerMotionStates.set(socketId, {
        from: currentPosition,
        to: { ...targetPosition },
        startTimeMs: frameTimestampMs,
        durationMs: shouldSmooth ? this.getMovementDurationMs(distance) : 0,
      });
    }

    for (const socketId of Array.from(this.playerMotionStates.keys())) {
      if (incomingSocketIds.has(socketId)) continue;
      this.playerMotionStates.delete(socketId);
      delete this.animatedPlayerPositions[socketId];
    }
  }

  private updateAnimatedPlayerPositions(frameTimestampMs: number): void {
    const nextPositions: Record<string, Vec2> = {};

    for (const [socketId, motionState] of this.playerMotionStates.entries()) {
      const currentPosition = this.getMotionPosition(motionState, frameTimestampMs);
      nextPositions[socketId] = currentPosition;

      if (this.hasMotionCompleted(motionState, frameTimestampMs)) {
        this.playerMotionStates.set(socketId, {
          from: { ...motionState.to },
          to: { ...motionState.to },
          startTimeMs: frameTimestampMs,
          durationMs: 0,
        });
      }
    }

    this.animatedPlayerPositions = nextPositions;
  }

  private getMotionPosition(motionState: PlayerMotionState, frameTimestampMs: number): Vec2 {
    if (motionState.durationMs <= 0) return { ...motionState.to };

    const elapsedMs = frameTimestampMs - motionState.startTimeMs;
    const linearProgress = this.clamp01(elapsedMs / motionState.durationMs);
    const easedProgress = this.easeInOutCubic(linearProgress);

    return {
      x: motionState.from.x + ((motionState.to.x - motionState.from.x) * easedProgress),
      y: motionState.from.y + ((motionState.to.y - motionState.from.y) * easedProgress),
    };
  }

  private hasMotionCompleted(motionState: PlayerMotionState, frameTimestampMs: number): boolean {
    if (motionState.durationMs <= 0) return true;
    return frameTimestampMs - motionState.startTimeMs >= motionState.durationMs;
  }

  private shouldSmoothMovement(from: Vec2, to: Vec2, distance: number): boolean {
    if (distance <= PLAYER_POSITION_EPSILON) return false;
    if (distance > PLAYER_TELEPORT_SNAP_DISTANCE) return false;
    if (!this.isGridAligned(from) || !this.isGridAligned(to)) return false;
    return true;
  }

  private isGridAligned(position: Vec2): boolean {
    return Number.isInteger(position.x) && Number.isInteger(position.y);
  }

  private getMovementDurationMs(distance: number): number {
    const scaledDuration = Math.round(PLAYER_MOVE_BASE_DURATION_MS * distance);
    return Math.min(PLAYER_MOVE_MAX_DURATION_MS, Math.max(PLAYER_MOVE_MIN_DURATION_MS, scaledDuration));
  }

  private getDistance(from: Vec2, to: Vec2): number {
    return Math.hypot(to.x - from.x, to.y - from.y);
  }

  private arePositionsClose(left: Vec2, right: Vec2): boolean {
    return Math.abs(left.x - right.x) <= PLAYER_POSITION_EPSILON && Math.abs(left.y - right.y) <= PLAYER_POSITION_EPSILON;
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private easeInOutCubic(progress: number): number {
    if (progress < EASE_IN_OUT_SWITCH_POINT) {
      return EASE_ACCELERATION_FACTOR * progress * progress * progress;
    }
    return 1 - Math.pow((EASE_DECELERATION_FACTOR * progress) + EASE_DECELERATION_OFFSET, EASE_POWER) / EASE_DECELERATION_DIVISOR;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.render();
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.lockCamera) return;
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
    if (this.lockCamera) return;

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
    if (this.lockCamera) return;

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

    const frameTimestampMs = performance.now();
    this.syncPlayerMotionStates(frameTimestampMs);
    this.updateAnimatedPlayerPositions(frameTimestampMs);

    this.isometricViewService.renderBoard({
      ctx,
      width: rect.width,
      height: rect.height,
      grid: this.grid,
      players: this.players,
      playerPositions: this.animatedPlayerPositions,
      playerStartPositions: this.playerStartPositions,
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
      showDirectionalKeys: this.showDirectionalKeys,
      pressedDirectionKey: this.pressedDirectionKey,
      flipXMap: this.playerFlipXMap || this.computedFlipXMap,
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