import { Vec2 } from '@common/vec2';

const DIRECTION_KEY_SIZE = 60;
const DIRECTION_KEY_CORNER_RADIUS = 8;
const DIRECTION_KEY_LINE_WIDTH = 4;

export function drawDirectionKey(
  ctx: CanvasRenderingContext2D,
  keyChar: string,
  options: {
    col: number;
    row: number;
    viewConfig: { originX: number; originY: number; tileW: number; tileH: number };
    toIsoProjector: (col: number, row: number, config: { originX: number; originY: number; tileW: number; tileH: number }) => Vec2;
  },
): void {
  const north = options.toIsoProjector(options.col, options.row, options.viewConfig);
  const east = options.toIsoProjector(options.col + 1, options.row, options.viewConfig);
  const west = options.toIsoProjector(options.col, options.row + 1, options.viewConfig);

  ctx.save();
  ctx.transform(
    (east.x - north.x) / DIRECTION_KEY_SIZE, (east.y - north.y) / DIRECTION_KEY_SIZE,
    (west.x - north.x) / DIRECTION_KEY_SIZE, (west.y - north.y) / DIRECTION_KEY_SIZE,
    north.x, north.y,
  );

  ctx.translate(-DIRECTION_KEY_SIZE / 2, -DIRECTION_KEY_SIZE / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = DIRECTION_KEY_LINE_WIDTH;

  ctx.beginPath();
  ctx.moveTo(DIRECTION_KEY_CORNER_RADIUS, 0);
  ctx.lineTo(DIRECTION_KEY_SIZE - DIRECTION_KEY_CORNER_RADIUS, 0);
  ctx.quadraticCurveTo(DIRECTION_KEY_SIZE, 0, DIRECTION_KEY_SIZE, DIRECTION_KEY_CORNER_RADIUS);
  ctx.lineTo(DIRECTION_KEY_SIZE, DIRECTION_KEY_SIZE - DIRECTION_KEY_CORNER_RADIUS);
  ctx.quadraticCurveTo(DIRECTION_KEY_SIZE, DIRECTION_KEY_SIZE, DIRECTION_KEY_SIZE - DIRECTION_KEY_CORNER_RADIUS, DIRECTION_KEY_SIZE);
  ctx.lineTo(DIRECTION_KEY_CORNER_RADIUS, DIRECTION_KEY_SIZE);
  ctx.quadraticCurveTo(0, DIRECTION_KEY_SIZE, 0, DIRECTION_KEY_SIZE - DIRECTION_KEY_CORNER_RADIUS);
  ctx.lineTo(0, DIRECTION_KEY_CORNER_RADIUS);
  ctx.quadraticCurveTo(0, 0, DIRECTION_KEY_CORNER_RADIUS, 0);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#3d3939ff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(keyChar, DIRECTION_KEY_SIZE / 2, DIRECTION_KEY_SIZE / 2 + 2);
  ctx.restore();
}
