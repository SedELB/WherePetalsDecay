import { TileItem } from '@common/enums';
import { Vec2 } from '@common/vec2';

const PULSE_BASE = 20;
const PULSE_SPEED = 150;
const PULSE_AMPLITUDE = 12;
const DOUBLE_PASS_MULTIPLIER = 2.0;
const INACTIVE_SANCTUARY_ALPHA = 0.6;

const SANCTUARY_ASSETS: Partial<Record<TileItem, string>> = {
    [TileItem.HealingSanctuary]: './assets/tiles/health_sanctuary.png',
    [TileItem.CombatSanctuary]: './assets/tiles/combat_sanctuary.png',
};

const SANCTUARY_WIDTH_SCALE: Partial<Record<TileItem, number>> = {
    [TileItem.HealingSanctuary]: 1.0,
    [TileItem.CombatSanctuary]: 1.0,
};


// 0.1 means shift down by 10% of the image's drawn height.
const SANCTUARY_Y_OFFSET_RATIO: Partial<Record<TileItem, number>> = {
    [TileItem.HealingSanctuary]: 0.10,
    [TileItem.CombatSanctuary]: 0.05,
};

export function drawSanctuarySprite(
    ctx: CanvasRenderingContext2D,
    item: TileItem,
    footprint: { north: Vec2; east: Vec2; south: Vec2; west: Vec2 },
    getImage: (src: string) => HTMLImageElement | null,
    options: { isGlowing?: boolean; isInactive?: boolean } = {},
): void {
    const { isGlowing = false, isInactive = false } = options;

    const src = SANCTUARY_ASSETS[item];
    if (!src) return;

    const img = getImage(src);
    if (!img?.complete || img.naturalWidth <= 0) return;

    const diamondW = footprint.east.x - footprint.west.x;
    const aspect = img.naturalWidth / img.naturalHeight;

    const drawW = diamondW * (SANCTUARY_WIDTH_SCALE[item] ?? 1.0);
    const drawH = drawW / aspect;

    const anchorX = (footprint.west.x + footprint.east.x) / 2;
    const anchorY = footprint.south.y;

    const GAME_ISO_RATIO = 2.5;
    const ASSET_ISO_RATIO = 2.0;
    const squashY = ASSET_ISO_RATIO / GAME_ISO_RATIO;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.scale(1, squashY);

    const yOffset = drawH * (SANCTUARY_Y_OFFSET_RATIO[item] ?? 0);
    const spriteLeft = -drawW / 2;
    const spriteTop = -drawH + yOffset;

    if (isInactive) {
        ctx.filter = 'grayscale(1)';
        ctx.globalAlpha = INACTIVE_SANCTUARY_ALPHA;
    }

    if (isGlowing) {
        const pulse = PULSE_BASE + Math.sin(Date.now() / PULSE_SPEED) * PULSE_AMPLITUDE;
        const localH = (footprint.south.y - footprint.north.y) / squashY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(-drawW, -drawH * 2, drawW * 2, drawH * 2 - localH / 2);
        ctx.clip();

        ctx.shadowColor = '#eddea7';
        ctx.shadowBlur = pulse;
        ctx.drawImage(img, spriteLeft, spriteTop, drawW, drawH);

        ctx.shadowBlur = pulse * DOUBLE_PASS_MULTIPLIER;
        ctx.drawImage(img, spriteLeft, spriteTop, drawW, drawH);

        ctx.restore();
    }

    ctx.drawImage(img, spriteLeft, spriteTop, drawW, drawH);

    ctx.restore();
}
