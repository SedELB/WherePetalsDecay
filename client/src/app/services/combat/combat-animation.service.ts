import { Injectable } from '@angular/core';
import { Vec2 } from '@common/vec2';
import { CombatStateService } from './combat-state.service';
import { FighterPositionAnimationParams } from '@app/interfaces/combat.interfaces';
import {
    EASE_PROGRESS_MIDDLE_POINT,
    EASE_ACCELERATION_FACTOR,
    EASE_DECELERATION_FACTOR,
    EASE_DECELERATION_OFFSET,
    EASE_POWER,
    EASE_DIVISOR,
    IMPACT_POPUP_DEFAULT_GRID_DIMENSION,
    IMPACT_POPUP_COMBAT_MAP_WIDTH_PX,
    IMPACT_POPUP_COMBAT_MAP_HEIGHT_PX,
    IMPACT_POPUP_TILE_CENTER_OFFSET,
    IMPACT_POPUP_AVATAR_VERTICAL_OFFSET_TILE_WIDTH_RATIO,
    IMPACT_POPUP_ADDITIONAL_VERTICAL_OFFSET_PX,
    TO_PERCENT,
} from '@app/components/combat/combat.constants';
import { MIN_TILE_W, TILE_RATIO, TILE_THICKNESS } from '@app/constants/isometric.constants';

@Injectable({
    providedIn: 'root',
})
export class CombatAnimationService {
    private movementAnimationFrameId: number | null = null;

    constructor(private readonly combatState: CombatStateService) {}

    animateFighterPosition({
        sequenceToken,
        fighterSocketId,
        from,
        to,
        durationMs,
        onComplete,
    }: FighterPositionAnimationParams): void {
        this.clearMovementAnimationFrame();
        if (durationMs <= 0) {
            this.updateFighterPos(fighterSocketId, to);
            onComplete();
            return;
        }

        const animationStartMs = performance.now();

        const step = (frameTimeMs: number) => {
            if (this.combatState.activeRoundSequenceToken() !== sequenceToken) return;

            const elapsedMs = frameTimeMs - animationStartMs;
            const linearProgress = Math.min(1, elapsedMs / durationMs);
            const easedProgress = this.calculateEasedProgress(linearProgress);

            const currentPos: Vec2 = {
                x: from.x + ((to.x - from.x) * easedProgress),
                y: from.y + ((to.y - from.y) * easedProgress),
            };

            this.updateFighterPos(fighterSocketId, currentPos);

            if (linearProgress >= 1) {
                this.movementAnimationFrameId = null;
                onComplete();
                return;
            }

            this.movementAnimationFrameId = requestAnimationFrame(step);
        };

        this.movementAnimationFrameId = requestAnimationFrame(step);
    }

    projectImpactPopupPosition(targetPosition: Vec2, gridDimensions: { rows: number; cols: number }): { leftPercent: number; topPercent: number } {
        const rows = gridDimensions.rows || IMPACT_POPUP_DEFAULT_GRID_DIMENSION;
        const cols = gridDimensions.cols || IMPACT_POPUP_DEFAULT_GRID_DIMENSION;
        const totalGridDimensions = cols + rows;

        const fitTileWidthPx = (2 * IMPACT_POPUP_COMBAT_MAP_WIDTH_PX) / totalGridDimensions;
        const tileWidthPx = Math.max(fitTileWidthPx, MIN_TILE_W);
        const tileHeightPx = tileWidthPx / TILE_RATIO;

        const originXPx = IMPACT_POPUP_COMBAT_MAP_WIDTH_PX / 2;
        const diamondHeightPx = totalGridDimensions * (tileHeightPx / 2);
        const originYPx = ((IMPACT_POPUP_COMBAT_MAP_HEIGHT_PX - TILE_THICKNESS) / 2) - (diamondHeightPx / 2);

        const centerX = targetPosition.x + IMPACT_POPUP_TILE_CENTER_OFFSET;
        const centerY = targetPosition.y + IMPACT_POPUP_TILE_CENTER_OFFSET;

        const projectedCenterXPx = originXPx + ((centerX - centerY) * (tileWidthPx / 2));
        const projectedCenterYPx = originYPx + ((centerX + centerY) * (tileHeightPx / 2));

        const popupYPx = projectedCenterYPx
            - (tileWidthPx * IMPACT_POPUP_AVATAR_VERTICAL_OFFSET_TILE_WIDTH_RATIO)
            - IMPACT_POPUP_ADDITIONAL_VERTICAL_OFFSET_PX;

        return {
            leftPercent: (projectedCenterXPx / IMPACT_POPUP_COMBAT_MAP_WIDTH_PX) * TO_PERCENT,
            topPercent: (popupYPx / IMPACT_POPUP_COMBAT_MAP_HEIGHT_PX) * TO_PERCENT,
        };
    }

    clearMovementAnimationFrame(): void {
        if (this.movementAnimationFrameId === null) return;
        cancelAnimationFrame(this.movementAnimationFrameId);
        this.movementAnimationFrameId = null;
    }

    private calculateEasedProgress(linearProgress: number): number {
        if (linearProgress < EASE_PROGRESS_MIDDLE_POINT) {
            return EASE_ACCELERATION_FACTOR * linearProgress * linearProgress * linearProgress;
        }
        return 1 - Math.pow((EASE_DECELERATION_FACTOR * linearProgress) + EASE_DECELERATION_OFFSET, EASE_POWER) / EASE_DIVISOR;
    }

    private updateFighterPos(socketId: string, position: Vec2): void {
        this.combatState.playerPos.update((positions) => ({
            ...positions,
            [socketId]: position,
        }));
    }
}
