import { Injectable } from '@angular/core';
import { Vec2 } from '@common/vec2';

const PLAYER_MOVE_BASE_DURATION_MS = 180;
const PLAYER_MOVE_MIN_DURATION_MS = 120;
const PLAYER_MOVE_MAX_DURATION_MS = 260;
const PLAYER_TELEPORT_SNAP_DISTANCE = 1.5;
const PLAYER_POSITION_EPSILON = 0.001;

export interface PlayerMotionState {
    from: Vec2;
    to: Vec2;
    startTimeMs: number;
    durationMs: number;
}

const EASE_IN_OUT_CUTOFF = 0.5;
const EASE_ACCEL_FACTOR = 4;
const EASE_POWER_CUBIC = 3;
const EASE_OFFSET = 2;
const EASE_DIVISOR = 2;

@Injectable({ providedIn: 'root' })
export class IsometricAnimationService {
    private playerMotionStates = new Map<string, PlayerMotionState>();
    private computedFlipXMap: Record<string, boolean> = {};
    private animatedPlayerPositions: Record<string, Vec2> = {};

    update(playerPositions: Record<string, Vec2>): void {
        const now = performance.now();
        const incomingIds = new Set(Object.keys(playerPositions));

        for (const [id, target] of Object.entries(playerPositions)) {
            const state = this.playerMotionStates.get(id);
            if (!state) {
                this.playerMotionStates.set(id, { from: { ...target }, to: { ...target }, startTimeMs: now, durationMs: 0 });
                continue;
            }

            if (this.arePositionsClose(state.to, target)) {
                continue;
            }

            const current = this.getMotionPosition(state, now);
            const dist = Math.hypot(target.x - current.x, target.y - current.y);
            const shouldSmooth = dist > PLAYER_POSITION_EPSILON && dist <= PLAYER_TELEPORT_SNAP_DISTANCE &&
                               Number.isInteger(current.x) && Number.isInteger(current.y) &&
                               Number.isInteger(target.x) && Number.isInteger(target.y);

            this.updateFlipX(id, current, target);

            this.playerMotionStates.set(id, {
                from: current,
                to: { ...target },
                startTimeMs: now,
                durationMs: shouldSmooth ? this.getDuration(dist) : 0,
            });
        }

        for (const id of Array.from(this.playerMotionStates.keys())) {
            if (!incomingIds.has(id)) {
                this.playerMotionStates.delete(id);
                delete this.animatedPlayerPositions[id];
            }
        }

        this.syncAnimatedPositions(now);
    }

    getAnimatedPositions(): Record<string, Vec2> {
        return this.animatedPlayerPositions;
    }

    getFlipXMap(): Record<string, boolean> {
        return this.computedFlipXMap;
    }

    private syncAnimatedPositions(now: number): void {
        for (const [id, state] of this.playerMotionStates.entries()) {
            this.animatedPlayerPositions[id] = this.getMotionPosition(state, now);
            if (state.durationMs > 0 && now - state.startTimeMs >= state.durationMs) {
                this.playerMotionStates.set(id, { from: { ...state.to }, to: { ...state.to }, startTimeMs: now, durationMs: 0 });
            }
        }
    }

    private getMotionPosition(state: PlayerMotionState, now: number): Vec2 {
        if (state.durationMs <= 0) {
            return { ...state.to };
        }
        const progress = Math.min(1, Math.max(0, (now - state.startTimeMs) / state.durationMs));
        const eased = progress < EASE_IN_OUT_CUTOFF
            ? EASE_ACCEL_FACTOR * progress ** EASE_POWER_CUBIC
            : 1 - ((-EASE_OFFSET * progress + EASE_OFFSET) ** EASE_POWER_CUBIC) / EASE_DIVISOR;
        return {
            x: state.from.x + (state.to.x - state.from.x) * eased,
            y: state.from.y + (state.to.y - state.from.y) * eased,
        };
    }

    private updateFlipX(id: string, current: Vec2, target: Vec2): void {
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        if (dx < -PLAYER_POSITION_EPSILON) {
            this.computedFlipXMap[id] = false;
        } else if (dx > PLAYER_POSITION_EPSILON) {
            this.computedFlipXMap[id] = true;
        } else if (dy < -PLAYER_POSITION_EPSILON) {
            this.computedFlipXMap[id] = true;
        } else if (dy > PLAYER_POSITION_EPSILON) {
            this.computedFlipXMap[id] = false;
        }
    }

    private getDuration(dist: number): number {
        return Math.min(PLAYER_MOVE_MAX_DURATION_MS, Math.max(PLAYER_MOVE_MIN_DURATION_MS, Math.round(PLAYER_MOVE_BASE_DURATION_MS * dist)));
    }

    private arePositionsClose(a: Vec2, b: Vec2): boolean {
        return Math.abs(a.x - b.x) <= PLAYER_POSITION_EPSILON && Math.abs(a.y - b.y) <= PLAYER_POSITION_EPSILON;
    }
}
