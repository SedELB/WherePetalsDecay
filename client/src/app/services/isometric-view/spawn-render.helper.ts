const LOCAL_SPAWN_ICON_TINT = 'rgba(140, 35, 35, 0.85)';
const OTHER_SPAWN_ICON_TINT = 'rgba(20, 20, 20, 0.85)';

export function drawSpawnIcon(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  drawRect: { x: number; y: number; width: number; height: number },
  isLocalSpawn: boolean,
): void {
  ctx.save();
  ctx.drawImage(image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = isLocalSpawn ? LOCAL_SPAWN_ICON_TINT : OTHER_SPAWN_ICON_TINT;
  ctx.fillRect(drawRect.x, drawRect.y, drawRect.width, drawRect.height);
  ctx.restore();
}
