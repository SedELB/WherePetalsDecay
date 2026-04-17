import {
    DAMAGE_POPUP_DURATION_MS,
    FIGHTER_IMPACT_DELAY_MS,
    FIGHTER_MOVEMENT_DURATION_MS,
    ROUND_ANNOUNCEMENT_DURATION_MS,
    ROUND_PHASE_DELAY_MS,
} from '@app/components/combat/combat.constants';
import { CombatSequenceDeps, LifeBySide, RoundPhaseStep, RoundResolutionSequenceParams } from '@app/interfaces/combat.interfaces';

export const animateMovement = (
    deps: CombatSequenceDeps,
    token: number,
    atkId: string,
    defId: string,
    callback: () => void,
): void => {
    const player = deps.state.player();
    const enemy = deps.state.enemy();
    if (!player || !enemy) {
        callback();
        return;
    }

    const base: Record<string, { x: number; y: number }> = {
        [player.socketId]: { x: 1, y: 2 },
        [enemy.socketId]: { x: 1, y: 0 },
    };
    const lunge = { x: base[atkId].x, y: base[atkId].y + (atkId === player.socketId ? -1 : 1) };

    deps.state.currentAttackerSocketId.set(atkId);
    deps.state.isAttackAnimationInProgress.set(true);

    deps.animation.animateFighterPosition({
        sequenceToken: token,
        fighterSocketId: atkId,
        from: base[atkId],
        to: lunge,
        durationMs: FIGHTER_MOVEMENT_DURATION_MS,
        onComplete: () => {
            const damage = deps.state.roundDamageByAttackerSocket()[atkId];
            deps.ui.spawnImpactDamagePopup(defId, damage, { rows: 3, cols: 3 });
            setTimeout(() => {
                deps.animation.animateFighterPosition({
                    sequenceToken: token,
                    fighterSocketId: atkId,
                    from: lunge,
                    to: base[atkId],
                    durationMs: FIGHTER_MOVEMENT_DURATION_MS,
                    onComplete: () => {
                        deps.state.isAttackAnimationInProgress.set(false);
                        deps.state.currentAttackerSocketId.set(null);
                        callback();
                    },
                });
            }, FIGHTER_IMPACT_DELAY_MS);
        },
    });
};

export const buildRoundSteps = (
    deps: CombatSequenceDeps,
    params: RoundResolutionSequenceParams,
    finishCb: (token: number) => void,
    finalizeLivesCb: () => void,
): RoundPhaseStep[] => {
    const playerId = deps.state.player()?.socketId ?? '';
    const enemyId = deps.state.enemy()?.socketId ?? '';
    const hasDeadFighter = () => deps.state.displayedLifeBySide().player <= 0 || deps.state.displayedLifeBySide().enemy <= 0;

    return [
        { delayMs: ROUND_PHASE_DELAY_MS, action: (next) => animateMovement(deps, params.sequenceToken, playerId, enemyId, next) },
        { delayMs: ROUND_PHASE_DELAY_MS, action: (next) => animateMovement(deps, params.sequenceToken, enemyId, playerId, next) },
        {
            delayMs: 0,
            action: (next) => {
                finalizeLivesCb();
                next();
            },
        },
        {
            delayMs: ROUND_PHASE_DELAY_MS,
            action: (next) => {
                deps.ui.showDamagePopup(params.damageDealt, params.damageReceived, params.roundIndex);
                next();
            },
        },
        {
            delayMs: DAMAGE_POPUP_DURATION_MS,
            action: (next) => {
                deps.ui.damagePopup.set(null);
                next();
            },
        },
        {
            delayMs: 0,
            action: (next) => {
                if (hasDeadFighter()) return finishCb(params.sequenceToken);
                deps.ui.showRoundAnnouncement(params.roundIndex + 1);
                next();
            },
        },
        {
            delayMs: ROUND_ANNOUNCEMENT_DURATION_MS,
            action: () => {
                deps.ui.roundAnnouncementPopup.set(null);
                finishCb(params.sequenceToken);
            },
        },
    ];
};

export const syncCombatLivesToLobby = (
    deps: CombatSequenceDeps,
    lifeBySide: LifeBySide,
): void => {
    const playerSocketId = deps.state.player()?.socketId;
    const enemySocketId = deps.state.enemy()?.socketId;
    if (!playerSocketId && !enemySocketId) return;

    const syncedLives: Record<string, number> = {};
    if (playerSocketId) syncedLives[playerSocketId] = Math.max(0, lifeBySide.player);
    if (enemySocketId) syncedLives[enemySocketId] = Math.max(0, lifeBySide.enemy);

    deps.gameViewService.syncCombatParticipantLives(syncedLives);
};

export const shouldDelayCombatEndPopup = (
    deps: CombatSequenceDeps,
    lastAppliedResultKey: string,
): boolean => {
    if (deps.state.isRoundSequenceInProgress()) return true;

    const latestResolvedRound = deps.gameViewService.lastCombatRoundResolved();
    const roomId = deps.gameViewService.getCurrentCombatRoomId();
    if (!latestResolvedRound || latestResolvedRound.roomId !== roomId) return false;

    const latestResolvedRoundKey = `${latestResolvedRound.roundIndex}:${latestResolvedRound.resolvedAtEpochMs}`;
    return latestResolvedRoundKey !== lastAppliedResultKey;
};
