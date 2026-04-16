import { RENDER_CONSTANTS } from '@app/constants/isometric.constants';
import { RenderBoardConfig } from '@app/interfaces/isometric-interfaces';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';

const PLAYER_NAME_VERTICAL_OFFSET = 5;
const SHADOW_ALPHA = 0.4;
const NAME_STROKE_WIDTH = 3;
const GLOW_OUTER_BLUR = 30;
const GLOW_MIDDLE_BLUR = 18;
const GLOW_INNER_BLUR = 8;
const GLOW_BLUR_LEVELS = [GLOW_OUTER_BLUR, GLOW_MIDDLE_BLUR, GLOW_INNER_BLUR, 0];
const PLAYER_NAME_FONT = 'bold 16px "PT Sans", sans-serif';
const HALF_TILE_OFFSET = 0.5;

export interface PlayerRenderParams {
    ctx: CanvasRenderingContext2D;
    players: Player[];
    playerPositions: Record<string, Vec2>;
    vertices: Vec2[][];
    config: RenderBoardConfig;
    getImage: (src: string) => HTMLImageElement | null;
}

export function renderPlayers(params: PlayerRenderParams): void {
    const sortedPlayers = params.players
        .map((player) => ({ player, position: params.playerPositions[player.socketId] }))
        .filter((entry): entry is { player: Player; position: Vec2 } => !!entry.position)
        .sort((left, right) => {
            const leftDepth = left.position.x + left.position.y;
            const rightDepth = right.position.x + right.position.y;
            if (leftDepth !== rightDepth) return leftDepth - rightDepth;
            return left.position.x - right.position.x;
        });

    for (const entry of sortedPlayers) {
        drawPlayerAtPosition({
            ctx: params.ctx,
            player: entry.player,
            position: entry.position,
            vertices: params.vertices,
            config: params.config,
            getImage: params.getImage,
        });
    }
}

function drawPlayerAtPosition(params: {
    ctx: CanvasRenderingContext2D;
    player: Player;
    position: Vec2;
    vertices: Vec2[][];
    config: RenderBoardConfig;
    getImage: (src: string) => HTMLImageElement | null;
}): void {
    if (!params.player?.character?.avatar) return;

    const projectedData = projectPlayerPosition(params.position, params.vertices);
    if (!projectedData) return;

    const playerImg = params.getImage(params.player.character.avatar);
    if (!playerImg?.complete || playerImg.naturalWidth <= 0) return;

    const aspect = playerImg.naturalWidth / playerImg.naturalHeight;
    const imgW = projectedData.tileW * RENDER_CONSTANTS.playerWidthRatio;
    const imgH = (imgW / aspect) * RENDER_CONSTANTS.playerHeightAdjustment;

    drawPlayerShadow(params.ctx, {
        cx: projectedData.cx,
        cy: projectedData.cy,
        tileH: projectedData.tileH,
        imgW,
        imgH,
    });

    drawPlayerSprite(
        params.ctx,
        playerImg,
        {
            x: projectedData.cx - imgW / 2,
            y: projectedData.cy - imgH + (projectedData.tileH * RENDER_CONSTANTS.playerDepthOffset),
            w: imgW,
            h: imgH,
            isFlipped: params.config.flipXMap?.[params.player.socketId] ?? false,
            glowColor: getPlayerGlowColor(params.player, params.config),
        },
    );

    const nameY = projectedData.cy - imgH + (projectedData.tileH * RENDER_CONSTANTS.playerDepthOffset) - PLAYER_NAME_VERTICAL_OFFSET;
    drawPlayerName(params.ctx, params.player.character.name, params.player.hasFlag, projectedData.cx, nameY);
}

function getPlayerGlowColor(player: Player, config: RenderBoardConfig): string | null {
    if (config.isCTF) {
        if (config.teamA?.some((t) => t.socketId === player.socketId)) return '#3b82f6';
        if (config.teamB?.some((t) => t.socketId === player.socketId)) return '#ef4444';
        return null;
    }

    return player.socketId === config.localPlayerSocketId ? '#00f2fe' : null;
}

function drawPlayerSprite(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    params: { x: number; y: number; w: number; h: number; isFlipped: boolean; glowColor: string | null },
): void {
    const { x, y, w, h, isFlipped, glowColor } = params;
    ctx.save();
    if (glowColor) {
        ctx.shadowColor = glowColor;
    }

    if (isFlipped) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    if (glowColor) {
        for (const blur of GLOW_BLUR_LEVELS) {
            ctx.shadowBlur = blur;
            ctx.drawImage(img, x, y, w, h);
        }
    } else {
        ctx.drawImage(img, x, y, w, h);
    }

    ctx.restore();
}

function drawPlayerName(
    ctx: CanvasRenderingContext2D,
    name: string,
    hasFlag: boolean,
    cx: number,
    y: number,
): void {
    ctx.save();
    ctx.font = PLAYER_NAME_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const text = hasFlag ? `${name} 🚩` : name;
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = NAME_STROKE_WIDTH;
    ctx.strokeText(text, cx, y);
    
    ctx.fillStyle = 'white';
    ctx.fillText(text, cx, y);
    ctx.restore();
}

function projectPlayerPosition(position: Vec2, vertices: Vec2[][]): {
    cx: number;
    cy: number;
    tileW: number;
    tileH: number;
} | null {
    const totalRows = vertices.length - 1;
    const totalColumns = vertices[0]?.length ? vertices[0].length - 1 : 0;
    if (totalRows <= 0 || totalColumns <= 0) return null;

    const centerX = position.x + HALF_TILE_OFFSET;
    const centerY = position.y + HALF_TILE_OFFSET;

    if (centerX < 0 || centerY < 0 || centerX > totalColumns || centerY > totalRows) return null;

    const baseColumn = Math.min(Math.max(Math.floor(centerX), 0), totalColumns - 1);
    const baseRow = Math.min(Math.max(Math.floor(centerY), 0), totalRows - 1);

    const tx = centerX - baseColumn;
    const ty = centerY - baseRow;

    const topLeft = vertices[baseRow][baseColumn];
    const topRight = vertices[baseRow][baseColumn + 1];
    const bottomLeft = vertices[baseRow + 1][baseColumn];
    const bottomRight = vertices[baseRow + 1][baseColumn + 1];

    const topX = topLeft.x + ((topRight.x - topLeft.x) * tx);
    const topY = topLeft.y + ((topRight.y - topLeft.y) * tx);
    const bottomX = bottomLeft.x + ((bottomRight.x - bottomLeft.x) * tx);
    const bottomY = bottomLeft.y + ((bottomRight.y - bottomLeft.y) * tx);

    const cx = topX + ((bottomX - topX) * ty);
    const cy = topY + ((bottomY - topY) * ty);

    const tileW = Math.max(1, Math.abs(topRight.x - bottomLeft.x));
    const tileH = Math.max(1, Math.abs(bottomRight.y - topLeft.y));

    return { cx, cy, tileW, tileH };
}

function drawPlayerShadow(ctx: CanvasRenderingContext2D, data: { cx: number; cy: number; tileH: number; imgW: number; imgH: number }): void {
    const shadowY = data.cy + (data.tileH * RENDER_CONSTANTS.shadowOffsetYRatio);
    const radiusX = data.imgW * RENDER_CONSTANTS.shadowRadiusXRatio;
    const radiusY = data.imgH * RENDER_CONSTANTS.shadowRadiusYRatio;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${SHADOW_ALPHA})`;
    ctx.beginPath();
    ctx.ellipse(data.cx, shadowY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}
