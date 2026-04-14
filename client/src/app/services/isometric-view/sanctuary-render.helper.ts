import { Vec2 } from '@common/vec2';
import { TileItem } from '@common/enums';

const SANCTUARY_ASSETS: Partial<Record<TileItem, string>> = {
    [TileItem.HealingSanctuary]: './assets/tiles/health_sanctuary.png',
    [TileItem.CombatSanctuary]: './assets/tiles/combat_sanctuary.png',
};

const SANCTUARY_WIDTH_SCALE: Partial<Record<TileItem, number>> = {
    [TileItem.HealingSanctuary]: 1.0,
    [TileItem.CombatSanctuary]: 0.90, // Scale down slightly so thick pillars stay inside the bounds!
};

const SANCTUARY_ROTATION: Partial<Record<TileItem, number>> = {
    [TileItem.HealingSanctuary]: 0, // Reset to 0 since squash perfectly aligns symmetric 2:1 assets
};

// Use this to shift the image down if its bottom tip doesn't touch the bottom pixel of the PNG.
// Ex: 0.1 means shift down by 10% of the image's drawn height.
const SANCTUARY_Y_OFFSET_RATIO: Partial<Record<TileItem, number>> = {
    [TileItem.HealingSanctuary]: 0.10, // Reduced from 0.15 since it overflowed slightly downwards
    [TileItem.CombatSanctuary]: 0.06,  // Shifting downwards to align the bottom pillar perfectly
};

export function drawSanctuarySprite(
    ctx: CanvasRenderingContext2D,
    item: TileItem,
    footprint: { north: Vec2; east: Vec2; south: Vec2; west: Vec2 },
    getImage: (src: string) => HTMLImageElement | null,
): void {
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

    const rotation = SANCTUARY_ROTATION[item] ?? 0;

    // The game uses a 2.5 grid ratio (flatter, 135 deg). The image uses a standard 2.0 ratio (2:1).
    // We vertically compress the asset so its base fits perfectly on the diamond tile.
    const GAME_ISO_RATIO = 2.5; 
    const ASSET_ISO_RATIO = 2.0;
    const squashY = ASSET_ISO_RATIO / GAME_ISO_RATIO;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    
    // Scale down the Y-axis to flatten the 2:1 shape into a 2.5:1 shape
    ctx.scale(1, squashY);

    if (rotation !== 0) {
        ctx.rotate(rotation);
    }

    const yOffset = drawH * (SANCTUARY_Y_OFFSET_RATIO[item] ?? 0);

    ctx.drawImage(img, -drawW / 2, -drawH + yOffset, drawW, drawH);
    ctx.restore();
}
