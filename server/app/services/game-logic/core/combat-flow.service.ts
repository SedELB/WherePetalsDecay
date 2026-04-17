import { VP_CONSTANTS } from '@app/constants/game-logic.constants';
import { CombatSession } from '@app/interfaces/combat.interface';
import { GameOverCallback } from '@app/interfaces/game-logic.interface';
import { VirtualPlayerService } from '@app/services/game-logic/virtual-player/virtual-player.service';
import { JournalService } from '@app/services/journal/journal.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Posture } from '@common/character';
import {
    COMBAT_POST_DEATH_RESUME_DELAY_MS, COMBAT_POSTURE_TIMEOUT_MS, COMBAT_ROUND_DELAY_MS, COMBAT_START_ANNOUNCEMENT_DELAY_MS,
    COUNTDOWN_TICK_MS, DAMAGE_DISPLAY_DURATION_MS, DEFAULT_POSTURE, DICE_RESULT_DISPLAY_DURATION_MS, DICE_ROLL_DURATION_MS,
    FIGHTER_ADVANCE_DURATION_MS, FIGHTER_HOLD_DURATION_MS, FIGHTER_RETREAT_DURATION_MS, NEXT_ROUND_ANNOUNCEMENT_DURATION_MS,
    POSTURE_RESULT_DISPLAY_DURATION_MS, ROUND_PHASE_BUFFER_MS, STATUS_BUFFER_DURATION_MS,
} from '@common/constants/combat-timeline.constants';
import { PlayerType } from '@common/enums';
import {
    CombatEndedData, CombatLockStateData, CombatResult, CombatRoundCountdownData, CombatRoundResolvedData, CombatRoundStartedData,
    CombatRoundTimelineData, PostureReceivedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable } from '@nestjs/common';
import type { Namespace, Server, Socket } from 'socket.io';
import { CombatStateService } from './combat-state.service';
import { GameLogicService } from './game-logic.service';
import { GameTurnSyncService } from './game-turn-sync.service';

@Injectable()
export class CombatFlowService {
    @Inject(LobbyService) private readonly lobbyService: LobbyService;
    @Inject(JournalService) private readonly journalService: JournalService;

    @Inject(GameLogicService) private readonly gameLogicService: GameLogicService;
    @Inject() private readonly combatState: CombatStateService;
    @Inject(VirtualPlayerService) private readonly virtualPlayerService: VirtualPlayerService;

    private server: Server;
    private syncService: GameTurnSyncService;
    private onGameOverCallback?: GameOverCallback;

    initialize(server: Server, syncService: GameTurnSyncService, onGameOverCallback?: GameOverCallback): void {
        this.server = server;
        this.syncService = syncService;
        this.onGameOverCallback = onGameOverCallback;
    }

    initializeCombat(lobbyId: string, attackerId: string, defenderId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const attackerPlayer = activeGame?.lobby.players.find((p) => p.socketId === attackerId);
        const defenderPlayer = activeGame?.lobby.players.find((p) => p.socketId === defenderId);

        if (!activeGame || !attackerPlayer || !defenderPlayer) return;

        const roomId = `fight${this.combatState.incrementFightCounter()}`;
        const socketsMap = (this.server as unknown as Namespace).sockets as Map<string, Socket>;
        const attackerSocket = socketsMap?.get(attackerId);
        const defenderSocket = socketsMap?.get(defenderId);

        if (attackerSocket) attackerSocket.join(roomId);
        if (defenderSocket) defenderSocket.join(roomId);

        const combatSession: CombatSession = {
            lobbyId,
            roomId,
            attackerId,
            defenderId,
            postures: new Map(),
            roundIndex: 1,
            awaitingPostures: false,
            consumeActionPointOnNextRound: true,
        };

        this.combatState.createSession(roomId, combatSession);
        this.gameLogicService.pauseTurnCycle(lobbyId);
        this.emitCombatLockState({
            lobbyId,
            isLocked: true,
            roomId,
            attackerSocketId: attackerId,
            defenderSocketId: defenderId,
        });

        this.server.to(lobbyId).emit(JoinGameEvents.CombatStarted, { player: attackerPlayer, enemy: defenderPlayer, roomId });
        this.journalService.addCombatStartEntry(lobbyId, attackerPlayer.character.name, defenderPlayer.character.name);

        combatSession.timeoutHandle = setTimeout(() => {
            if (this.combatState.getSession(roomId)) this.startCombatRoundAwaitingPostures(combatSession);
        }, COMBAT_START_ANNOUNCEMENT_DELAY_MS);
    }

    handlePostureReceived(roomId: string, socketId: string, posture: Posture): void {
        const session = this.combatState.getSession(roomId);
        if (!session || !session.awaitingPostures) return;
        if (socketId !== session.attackerId && socketId !== session.defenderId) return;

        const normalizedPosture = this.combatState.normalizePosture(posture);
        session.postures.set(socketId, normalizedPosture);

        const postureData: PostureReceivedData = { socketId, posture: normalizedPosture };
        this.server.to(session.lobbyId).emit(JoinGameEvents.PostureReceived, postureData);

        if (session.postures.has(session.attackerId) && session.postures.has(session.defenderId)) {
            this.resolveCombatSession(roomId);
        }
    }

    resolveCombatSession(roomId: string, timedOutSocketIds: string[] = []): void {
        const session = this.combatState.getSession(roomId);
        if (!session || !session.awaitingPostures) return;

        this.combatState.clearSessionTimers(session);

        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) {
            this.abortCombat(session.roomId, session.lobbyId, session.attackerId, session.defenderId);
            return;
        }

        const attacker = activeGame.lobby.players.find((player) => player.socketId === session.attackerId);
        const defender = activeGame.lobby.players.find((player) => player.socketId === session.defenderId);
        if (!attacker || !defender) {
            this.abortCombat(session.roomId, session.lobbyId, session.attackerId, session.defenderId);
            return;
        }

        attacker.character.bonusPosture = session.postures.get(session.attackerId) ?? { ...DEFAULT_POSTURE };
        defender.character.bonusPosture = session.postures.get(session.defenderId) ?? { ...DEFAULT_POSTURE };

        session.awaitingPostures = false;
        this.executeCombatRound(session.roomId, session.consumeActionPointOnNextRound, timedOutSocketIds);
    }

    executeCombatRound(roomId: string, consumeActionPoint: boolean, timedOutSocketIds: string[] = []): void {
        const session = this.combatState.getSession(roomId);
        if (!session) return;
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        const debugDiceMode = Boolean(activeGame?.isDebugMode);

        const timeline: CombatRoundTimelineData = {
            postureResultDisplayDurationMs: POSTURE_RESULT_DISPLAY_DURATION_MS, roundPhaseBufferMs: ROUND_PHASE_BUFFER_MS,
            diceRollDurationMs: DICE_ROLL_DURATION_MS, diceResultDisplayDurationMs: DICE_RESULT_DISPLAY_DURATION_MS,
            damageDisplayDurationMs: DAMAGE_DISPLAY_DURATION_MS, fighterAdvanceDurationMs: FIGHTER_ADVANCE_DURATION_MS,
            fighterHoldDurationMs: FIGHTER_HOLD_DURATION_MS, fighterRetreatDurationMs: FIGHTER_RETREAT_DURATION_MS,
            statusBufferDurationMs: STATUS_BUFFER_DURATION_MS, nextRoundAnnouncementDurationMs: NEXT_ROUND_ANNOUNCEMENT_DURATION_MS,
        };

        const combatResult = this.gameLogicService.initiateCombat({
            lobbyId: session.lobbyId, attackerId: session.attackerId, defenderId: session.defenderId, consumeActionPoint,
        }) as CombatResult | null;

        if (!combatResult) {
            this.abortCombat(session.roomId, session.lobbyId, session.attackerId, session.defenderId, true);
            return;
        }

        const roundResolvedData: CombatRoundResolvedData = {
            roomId: session.roomId, roundIndex: session.roundIndex, result: combatResult,
            resolvedAtEpochMs: Date.now(), timeline, debugDiceMode,
            ...(timedOutSocketIds.length > 0 ? { timedOutSocketIds } : {}),
        };
        this.server.to(session.lobbyId).emit(JoinGameEvents.CombatRoundResolved, roundResolvedData);
        this.server.to(session.lobbyId).emit(JoinGameEvents.CombatResult, combatResult);
        this.emitCombatJournalEntries(session, combatResult);

        const isFightOver = combatResult.attacker.killed || combatResult.defender.killed;
        if (!isFightOver) {
            session.consumeActionPointOnNextRound = false;
            session.timeoutHandle = setTimeout(() => this.prepareNextCombatRound(session.roomId), COMBAT_ROUND_DELAY_MS);
            return;
        }
        this.handleCombatEnd(session, combatResult);
    }

    private handleCombatEnd(session: CombatSession, combatResult: CombatResult): void {
        const attackerName = this.gameLogicService.getPlayerName(session.lobbyId, session.attackerId, 'Attaquant');
        const defenderName = this.gameLogicService.getPlayerName(session.lobbyId, session.defenderId, 'Défenseur');
        const winnerName = combatResult.winnerId === session.attackerId ? attackerName : defenderName;
        const loserName = combatResult.winnerId === session.attackerId ? defenderName : attackerName;
        this.journalService.addCombatEndEntry(session.lobbyId, winnerName, loserName);

        const combatEndedData: CombatEndedData = {
            roomId: session.roomId, attackerSocketId: session.attackerId, defenderSocketId: session.defenderId,
            attackerKilled: combatResult.attacker.killed, defenderKilled: combatResult.defender.killed,
            winnerId: combatResult.winnerId, reason: 'death',
        };
        this.server.to(session.lobbyId).emit(JoinGameEvents.CombatEnded, combatEndedData);
        this.finalizeCombatSession(session, combatResult);
    }

    private prepareNextCombatRound(roomId: string): void {
        const session = this.combatState.getSession(roomId);
        if (!session) return;
        session.postures.clear();
        session.roundIndex += 1;
        session.awaitingPostures = false;
        this.startCombatRoundAwaitingPostures(session);
    }

    private finalizeCombatSession(session: CombatSession, finalResult: CombatResult): void {
        this.combatState.clearSessionTimers(session);
        this.emitCombatLockState({
            lobbyId: session.lobbyId, isLocked: false, roomId: session.roomId,
            attackerSocketId: session.attackerId, defenderSocketId: session.defenderId,
        });

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        if (winner) {
            this.onGameOverCallback?.(session.lobbyId, winner.socketId);
            this.cleanupCombatSession(session.roomId);
            return;
        }

        if (finalResult.winnerId === session.attackerId) {
            this.combatState.schedulePostCombatTurnResume(session.lobbyId, COMBAT_POST_DEATH_RESUME_DELAY_MS, () => {
                this.gameLogicService.resumeTurnCycle(session.lobbyId);
                this.sendActionPoints(session.lobbyId, session.attackerId);

                const winnerGame = this.gameLogicService.getActiveGame(session.lobbyId);
                const winnerPlayer = winnerGame?.lobby.players.find((p) => p.socketId === session.attackerId);
                if (winnerPlayer?.playerType === PlayerType.Virtual) {
                    this.triggerVirtualPlayerTurnIfNeeded(session.lobbyId, session.attackerId);
                } else {
                    this.syncService.autoEndTurnIfNoActions(session.lobbyId, session.attackerId);
                }
            });
        } else {
            this.combatState.schedulePostCombatTurnResume(session.lobbyId, COMBAT_POST_DEATH_RESUME_DELAY_MS, () => {
                this.gameLogicService.endTurn(session.lobbyId);
            });
        }
        this.cleanupCombatSession(session.roomId);
    }

    resolveCombatByAbandon(session: CombatSession, loserId: string, winnerId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) {
            this.abortCombat(session.roomId, session.lobbyId, session.attackerId, session.defenderId);
            return;
        }

        const winnerPlayer = activeGame.lobby.players.find((player) => player.socketId === winnerId);
        if (winnerPlayer && !winnerPlayer.hasAbandonned) winnerPlayer.winsCount += 1;

        const combatEndedData: CombatEndedData = {
            roomId: session.roomId, attackerSocketId: session.attackerId, defenderSocketId: session.defenderId,
            attackerKilled: loserId === session.attackerId, defenderKilled: loserId === session.defenderId,
            winnerId, reason: 'abandon',
        };
        this.server.to(session.lobbyId).emit(JoinGameEvents.CombatEnded, combatEndedData);
        this.emitCombatLockState({
            lobbyId: session.lobbyId, isLocked: false, roomId: session.roomId,
            attackerSocketId: session.attackerId, defenderSocketId: session.defenderId,
        });

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        if (winner) {
            this.onGameOverCallback?.(session.lobbyId, winner.socketId);
        }
        this.cleanupCombatSession(session.roomId);
    }

    startCombatRoundAwaitingPostures(session: CombatSession): void {
        session.awaitingPostures = true;
        let secondsLeft = COMBAT_POSTURE_TIMEOUT_MS / COUNTDOWN_TICK_MS;

        const broadcastCountdown = (timeLeft: number) => {
            const data: CombatRoundCountdownData = { roomId: session.roomId, roundIndex: session.roundIndex, secondsLeft: timeLeft };
            this.server.to(session.lobbyId).emit(JoinGameEvents.CombatRoundCountdown, data);
        };

        broadcastCountdown(secondsLeft);

        const attacker = this.lobbyService.getLobby(session.lobbyId)?.players.find((p) => p.socketId === session.attackerId);
        const defender = this.lobbyService.getLobby(session.lobbyId)?.players.find((p) => p.socketId === session.defenderId);

        const handleVp = (socketId: string) => {
            setTimeout(() => {
                const posture = this.virtualPlayerService.getPosture(session.lobbyId, socketId);
                if (posture) {
                    session.postures.set(socketId, posture);
                    this.server.to(session.lobbyId).emit(JoinGameEvents.PostureReceived, { socketId, posture });
                    if (session.postures.has(session.attackerId) && session.postures.has(session.defenderId)) {
                        this.resolveCombatSession(session.roomId);
                    }
                }
            }, VP_CONSTANTS.stepDelayMs);
        };

        if (attacker?.playerType === PlayerType.Virtual) handleVp(session.attackerId);
        if (defender?.playerType === PlayerType.Virtual) handleVp(session.defenderId);

        session.countdownHandle = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) this.handleCombatRoundTimeout(session.roomId);
            else broadcastCountdown(secondsLeft);
        }, COUNTDOWN_TICK_MS);

        const roundStartedData: CombatRoundStartedData = {
            roomId: session.roomId, roundIndex: session.roundIndex, postureTimeoutMs: COMBAT_POSTURE_TIMEOUT_MS,
        };
        this.server.to(session.lobbyId).emit(JoinGameEvents.CombatRoundStarted, roundStartedData);
    }

    private handleCombatRoundTimeout(roomId: string): void {
        const session = this.combatState.getSession(roomId);
        if (!session) return;
        const timedOutSocketIds: string[] = [];
        if (!session.postures.has(session.attackerId)) timedOutSocketIds.push(session.attackerId);
        if (!session.postures.has(session.defenderId)) timedOutSocketIds.push(session.defenderId);
        this.resolveCombatSession(roomId, timedOutSocketIds);
    }

    triggerVirtualPlayerTurnIfNeeded(lobbyId: string, socketId: string): void {
        const lobby = this.lobbyService.getLobby(lobbyId);
        const player = lobby?.players.find((p) => p.socketId === socketId);
        if (player?.playerType !== PlayerType.Virtual) return;

        const startCombat = (lid: string, attackerId: string, defenderId: string) => {
            this.initializeCombat(lid, attackerId, defenderId);
        };

        const onGameEnded = (lid: string, winnerId: string) => {
            this.onGameOverCallback?.(lid, winnerId);
        };

        this.virtualPlayerService.triggerTurn(this.server, lobbyId, socketId, startCombat, onGameEnded);
    }

    private cleanupCombatSession(roomId: string): void {
        const session = this.combatState.getSession(roomId);
        if (!session) return;
        this.combatState.clearSessionTimers(session);
        this.server.in(roomId).socketsLeave(roomId);
        this.combatState.deleteSession(roomId);
    }

    private emitCombatJournalEntries(session: CombatSession, result: CombatResult): void {
        const attackerName = this.gameLogicService.getPlayerName(session.lobbyId, session.attackerId, 'Attaquant');
        const defenderName = this.gameLogicService.getPlayerName(session.lobbyId, session.defenderId, 'Défenseur');
        this.journalService.addCombatRoundEntries(session.lobbyId, {
            attackerId: session.attackerId,
            attackerName,
            attackerAttack: result.attacker.attack,
            attackerDefense: result.attacker.defense,
            defenderId: session.defenderId,
            defenderName,
            defenderAttack: result.defender.attack,
            defenderDefense: result.defender.defense,
            damageToDefender: result.attacker.damageDealt,
            damageToAttacker: result.defender.damageDealt,
        });
    }

    emitCombatLockState(data: CombatLockStateData): void {
        this.server.to(data.lobbyId).emit(JoinGameEvents.CombatLockStateChanged, data);
    }

    private abortCombat(roomId: string, lobbyId: string, attackerId: string, defenderId: string, resumeTurn = false): void {
        this.emitCombatLockState({ lobbyId, isLocked: false, roomId, attackerSocketId: attackerId, defenderSocketId: defenderId });
        if (resumeTurn) this.gameLogicService.resumeTurnCycle(lobbyId);
        this.cleanupCombatSession(roomId);
    }

    private sendActionPoints(lobbyId: string, socketId: string): void {
        this.syncService.emitActionPoints(this.server, lobbyId, socketId);
    }
}
