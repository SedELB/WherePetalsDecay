const SPAWN_CENTER_Y_OFFSET_RATIO = 0.35;
const SPAWN_PEDESTAL_WIDTH_RATIO = 0.4;
const SPAWN_PEDESTAL_HEIGHT_RATIO = 0.15;
const SPAWN_OTHER_ALPHA = 0.45;
const SPAWN_GLOW_BLUR = 15;
const SPAWN_PEDESTAL_ALPHA = 0.4;
const SPAWN_LINE_WIDTH = 2;

export function drawSpawnIcon(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  drawRect: { x: number; y: number; width: number; height: number },
  isLocalSpawn: boolean,
  isFlagCarrierSpawn = false,
): void {
  ctx.save();

  if (isLocalSpawn || isFlagCarrierSpawn) {
    const centerX = drawRect.x + drawRect.width / 2;
    const centerY = drawRect.y + drawRect.height / 2 + drawRect.height * SPAWN_CENTER_Y_OFFSET_RATIO;
    const color = isFlagCarrierSpawn && !isLocalSpawn ? '#ff4444' : '#ffff00';

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, drawRect.width * SPAWN_PEDESTAL_WIDTH_RATIO, drawRect.height * SPAWN_PEDESTAL_HEIGHT_RATIO, 0, 0, Math.PI * 2);
    ctx.fillStyle = isFlagCarrierSpawn && !isLocalSpawn ? `rgba(255, 68, 68, ${SPAWN_PEDESTAL_ALPHA})` : `rgba(255, 255, 0, ${SPAWN_PEDESTAL_ALPHA})`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = SPAWN_LINE_WIDTH;
    ctx.stroke();

    ctx.shadowColor = color;
    ctx.shadowBlur = SPAWN_GLOW_BLUR;
    ctx.drawImage(image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
  } else {
    ctx.globalAlpha = SPAWN_OTHER_ALPHA;
    ctx.drawImage(image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
  }

  ctx.restore();
}
