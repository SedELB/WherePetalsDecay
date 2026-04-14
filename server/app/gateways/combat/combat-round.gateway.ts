import { CombatResolutionGateway } from '@app/gateways/combat/combat-resolution.gateway';
import {
    ATTACK_ANIMATION_DURATION_MS,
    COMBAT_POSTURE_TIMEOUT_MS,
    COMBAT_ROUND_DELAY_MS,
    CombatSession,
    CombatSessionService,
    COUNTDOWN_TICK_MS,
    DEFAULT_POSTURE,
    VP_POSTURE_MAX_DELAY_MS,
} from '@app/gateways/combat/combat-session.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { JournalService } from '@app/services/journal/journal.service';
import { Posture } from '@common/character';
import { PlayerType, SocketNamespace, VirtualPlayerProfile } from '@common/enums';
import {
    CombatAttackAnimationData,
    CombatResult,
    CombatRoundCountdownData,
    CombatRoundResolvedData,
    CombatRoundStartedData,
    PostureReceivedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { JournalEventType } from '@common/journal-entry';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class CombatRoundGateway {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly combatSessionService: CombatSessionService,
        @Inject(forwardRef(() => CombatResolutionGateway))
        private readonly combatResolutionGateway: CombatResolutionGateway,
        private readonly gameLogicService: GameLogicService,
        private readonly journalService: JournalService,
    ) {}

    @SubscribeMessage(JoinGameEvents.SendPosture)
    handlePostureReceived(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { lobbyId: string; roomId: string; posture: Posture },
    ): void {
        const { lobbyId, roomId, posture } = data;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const isPlayerInLobby = activeGame.lobby.players.some((player) => player.socketId === socket.id);
        if (!isPlayerInLobby || !socket.rooms.has(roomId)) return;

        const session = this.combatSessionService.getSession(roomId);
        if (!session || !session.awaitingPostures) return;
        if (socket.id !== session.attackerId && socket.id !== session.defenderId) return;

        const normalizedPosture = this.normalizePosture(posture);
        session.postures.set(socket.id, normalizedPosture);

        const postureData: PostureReceivedData = { socketId: socket.id, posture: normalizedPosture };
        socket.to(roomId).emit(JoinGameEvents.PostureReceived, postureData);

        if (session.postures.has(session.attackerId) && session.postures.has(session.defenderId)) {
            this.resolveCombatSession(roomId);
        }
    }

    startCombatRoundAwaitingPostures(session: CombatSession): void {
        this.combatSessionService.clearCombatSessionTimers(session);
        session.awaitingPostures = true;

        const roundStartedData: CombatRoundStartedData = {
            roomId: session.roomId,
            roundIndex: session.roundIndex,
            postureTimeoutMs: COMBAT_POSTURE_TIMEOUT_MS,
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatRoundStarted, roundStartedData);

        // Schedule posture submission for virtual player with a random delay
        this.scheduleVirtualPlayerPostures(session);

        let secondsLeft = Math.ceil(COMBAT_POSTURE_TIMEOUT_MS / COUNTDOWN_TICK_MS);
        const emitCountdown = () => {
            const roundCountdownData: CombatRoundCountdownData = {
                roomId: session.roomId,
                roundIndex: session.roundIndex,
                secondsLeft,
            };
            this.server.to(session.roomId).emit(JoinGameEvents.CombatRoundCountdown, roundCountdownData);
        };

        emitCountdown();
        session.countdownHandle = setInterval(() => {
            if (!session.awaitingPostures) {
                this.combatSessionService.clearCombatSessionTimers(session);
                return;
            }

            secondsLeft--;
            if (secondsLeft <= 0) {
                if (session.countdownHandle) {
                    clearInterval(session.countdownHandle);
                    session.countdownHandle = undefined;
                }
                return;
            }

            emitCountdown();
        }, COUNTDOWN_TICK_MS);

        session.timeoutHandle = setTimeout(() => {
            if (!session.awaitingPostures) return;

            const timedOutSocketIds = [session.attackerId, session.defenderId].filter((socketId) => !session.postures.has(socketId));
            for (const socketId of timedOutSocketIds) {
                session.postures.set(socketId, { ...DEFAULT_POSTURE });
            }

            this.resolveCombatSession(session.roomId, timedOutSocketIds);
        }, COMBAT_POSTURE_TIMEOUT_MS);
    }

    private resolveCombatSession(roomId: string, timedOutSocketIds: string[] = []): void {
        const session = this.combatSessionService.getSession(roomId);
        if (!session || !session.awaitingPostures) return;

        this.combatSessionService.clearCombatSessionTimers(session);

        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) {
            this.combatResolutionGateway.emitCombatLockState(this.server, {
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
            this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
            return;
        }

        const attacker = activeGame.lobby.players.find((player) => player.socketId === session.attackerId);
        const defender = activeGame.lobby.players.find((player) => player.socketId === session.defenderId);
        if (!attacker || !defender) {
            this.combatResolutionGateway.emitCombatLockState(this.server, {
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
            this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
            return;
        }

        attacker.character.bonusPosture = session.postures.get(session.attackerId) ?? { ...DEFAULT_POSTURE };
        defender.character.bonusPosture = session.postures.get(session.defenderId) ?? { ...DEFAULT_POSTURE };

        session.awaitingPostures = false;
        const attackAnimationData: CombatAttackAnimationData = {
            lobbyId: session.lobbyId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
            durationMs: ATTACK_ANIMATION_DURATION_MS,
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatAttackAnimation, attackAnimationData);

        session.timeoutHandle = setTimeout(() => {
            const activeSession = this.combatSessionService.getSession(session.roomId);
            if (!activeSession) return;

            this.executeCombatRound(activeSession.roomId, activeSession.consumeActionPointOnNextRound, timedOutSocketIds);
        }, ATTACK_ANIMATION_DURATION_MS);
    }

    private executeCombatRound(roomId: string, consumeActionPoint: boolean, timedOutSocketIds: string[] = []): void {
        const session = this.combatSessionService.getSession(roomId);
        if (!session) return;

        const combatResult = this.gameLogicService.initiateCombat(
            session.lobbyId,
            session.attackerId,
            session.defenderId,
            consumeActionPoint,
        ) as CombatResult | null;

        if (!combatResult) {
            this.combatResolutionGateway.emitCombatLockState(this.server, {
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
            this.gameLogicService.resumeTurnCycle(session.lobbyId);
            this.combatSessionService.cleanupCombatSession(this.server, session.roomId);
            return;
        }

        const roundResolvedData: CombatRoundResolvedData = {
            roomId: session.roomId,
            roundIndex: session.roundIndex,
            result: combatResult,
            ...(timedOutSocketIds.length > 0 ? { timedOutSocketIds } : {}),
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatRoundResolved, roundResolvedData);
        this.server.to(session.lobbyId).emit(JoinGameEvents.CombatResult, combatResult);

        this.emitCombatJournalEntries(session, combatResult);

        const isFightOver = combatResult.attacker.killed || combatResult.defender.killed;
        if (!isFightOver) {
            session.consumeActionPointOnNextRound = false;
            session.timeoutHandle = setTimeout(() => {
                this.prepareNextCombatRound(session.roomId);
            }, COMBAT_ROUND_DELAY_MS);
            return;
        }

        this.combatResolutionGateway.handleCombatEnd(session, combatResult);
    }

    private prepareNextCombatRound(roomId: string): void {
        const session = this.combatSessionService.getSession(roomId);
        if (!session) return;

        session.postures.clear();
        session.roundIndex++;
        session.awaitingPostures = false;
        this.startCombatRoundAwaitingPostures(session);
    }

    // Schedules posture submission for each virtual player participant
    // with a random delay (VP_POSTURE_MAX_DELAY_MS)
    private scheduleVirtualPlayerPostures(session: CombatSession): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) return;

        for (const participantId of [session.attackerId, session.defenderId]) {
            const participant = activeGame.lobby.players.find((p) => p.socketId === participantId);
            if (!participant || participant.playerType !== PlayerType.Virtual) continue;

            const posture =
                participant.virtualProfile === VirtualPlayerProfile.Aggressive
                    ? { type: 'atk' as const, bonus: 2 as const }
                    : { type: 'def' as const, bonus: 2 as const };

            const delay = Math.random() * VP_POSTURE_MAX_DELAY_MS;
            setTimeout(() => {
                const currentSession = this.combatSessionService.getSession(session.roomId);
                if (!currentSession || !currentSession.awaitingPostures) return;
                if (currentSession.postures.has(participantId)) return;

                currentSession.postures.set(participantId, posture);

                if (currentSession.postures.has(currentSession.attackerId) && currentSession.postures.has(currentSession.defenderId)) {
                    this.resolveCombatSession(currentSession.roomId);
                }
            }, delay);
        }
    }

    private normalizePosture(posture: Posture | null | undefined): Posture {
        const postureType = posture?.type === 'atk' || posture?.type === 'def' ? posture.type : null;
        if (!postureType) return { ...DEFAULT_POSTURE };
        return { type: postureType, bonus: 2 };
    }

    private emitCombatJournalEntries(session: CombatSession, combatResult: CombatResult): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) return;

        const attackerName = activeGame.lobby.players.find((p) => p.socketId === session.attackerId)?.character?.name ?? 'Attaquant';
        const defenderName = activeGame.lobby.players.find((p) => p.socketId === session.defenderId)?.character?.name ?? 'Défenseur';

        const atkAtk = combatResult.attacker.attack;
        const atkDef = combatResult.attacker.defense;
        const defAtk = combatResult.defender.attack;
        const defDef = combatResult.defender.defense;

        // Attacker's attack detail
        this.journalService.addEntry(session.lobbyId, {
            eventType: JournalEventType.CombatAttackDetail,
            playerNames: [attackerName],
            message: `Attaque de ${attackerName} : base=${atkAtk.base}, posture=+${atkAtk.postureBonus}, ` +
                `dé=+${atkAtk.diceBonus}, malus=-${atkAtk.penalty}, total=${atkAtk.total}`,
            isPrivate: true,
            involvedPlayerIds: [session.attackerId, session.defenderId],
        });

        // Attacker's defense detail
        this.journalService.addEntry(session.lobbyId, {
            eventType: JournalEventType.CombatDefenseDetail,
            playerNames: [attackerName],
            message: `Défense de ${attackerName} : base=${atkDef.base}, posture=+${atkDef.postureBonus}, ` +
                `dé=+${atkDef.diceBonus}, malus=-${atkDef.penalty}, total=${atkDef.total}`,
            isPrivate: true,
            involvedPlayerIds: [session.attackerId, session.defenderId],
        });

        // Defender's attack detail
        this.journalService.addEntry(session.lobbyId, {
            eventType: JournalEventType.CombatAttackDetail,
            playerNames: [defenderName],
            message: `Attaque de ${defenderName} : base=${defAtk.base}, posture=+${defAtk.postureBonus}, ` +
                `dé=+${defAtk.diceBonus}, malus=-${defAtk.penalty}, total=${defAtk.total}`,
            isPrivate: true,
            involvedPlayerIds: [session.attackerId, session.defenderId],
        });

        // Defender's defense detail
        this.journalService.addEntry(session.lobbyId, {
            eventType: JournalEventType.CombatDefenseDetail,
            playerNames: [defenderName],
            message: `Défense de ${defenderName} : base=${defDef.base}, posture=+${defDef.postureBonus}, ` +
                `dé=+${defDef.diceBonus}, malus=-${defDef.penalty}, total=${defDef.total}`,
            isPrivate: true,
            involvedPlayerIds: [session.attackerId, session.defenderId],
        });

        // Damage differences
        const dmgToDefender = combatResult.attacker.damageDealt;
        const dmgToAttacker = combatResult.defender.damageDealt;

        this.journalService.addEntry(session.lobbyId, {
            eventType: JournalEventType.CombatDamageResult,
            playerNames: [attackerName, defenderName],
            message: `${attackerName} attaque(${atkAtk.total}) - ${defenderName} défense(${defDef.total}) = ${dmgToDefender} dégât(s). ` +
                `${defenderName} attaque(${defAtk.total}) - ${attackerName} défense(${atkDef.total}) = ${dmgToAttacker} dégât(s).`,
            isPrivate: true,
            involvedPlayerIds: [session.attackerId, session.defenderId],
        });

        // Round damage result
        if (dmgToDefender > 0) {
            this.journalService.addCombatDamageEntry(session.lobbyId, attackerName, defenderName, session.attackerId, session.defenderId);
        }
        if (dmgToAttacker > 0) {
            this.journalService.addCombatDamageEntry(session.lobbyId, defenderName, attackerName, session.attackerId, session.defenderId);
        }
    }
}
