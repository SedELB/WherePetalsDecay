/* eslint-disable max-lines */
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Posture } from '@common/character';
import { Direction } from '@common/direction';
import { GameMode, SocketNamespace } from '@common/enums';
import {
    CombatEndedData,
    CombatResult,
    CombatRoundCountdownData,
    CombatRoundResolvedData,
    CombatRoundStartedData,
    CombatStartedData,
    PostureReceivedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Player } from '@common/player';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameTurnSyncService } from './game-turn-sync.service';

const COMBAT_ROUND_DELAY_MS = 2000;
const COMBAT_POSTURE_TIMEOUT_MS = 10000;
const COUNTDOWN_TICK_MS = 1000;
const DEFAULT_POSTURE: Posture = { type: null, bonus: 0 };

interface CombatSession {
    lobbyId: string;
    roomId: string;
    attackerId: string;
    defenderId: string;
    postures: Map<string, Posture>;
    roundIndex: number;
    awaitingPostures: boolean;
    consumeActionPointOnNextRound: boolean;
    timeoutHandle?: ReturnType<typeof setTimeout>;
    countdownHandle?: ReturnType<typeof setInterval>;
}

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    private fightCounter = 0;
    private readonly endGamePlayers = new Map<string, Set<string>>();
    private readonly combatSessions = new Map<string, CombatSession>();

    constructor(
        private readonly logger: Logger,
        private readonly gameLogicService: GameLogicService,
        private readonly lobbyService: LobbyService,
        private readonly gameTurnSyncService: GameTurnSyncService,
    ) {}

    afterInit(): void {
        this.logger.log('GameGateway initialized on /join namespace');
        this.gameLogicService.setCallbacks({
            onBetweenTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.BetweenTurnCountdown, secondsLeft);
            },
            onTurnCountdown: (lobbyId: string, secondsLeft: number) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnCountdown, secondsLeft);
            },
            onTurnStarted: (lobbyId: string, playerSocketId: string) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnStarted, playerSocketId);
                this.gameTurnSyncService.syncPlayerTurnState(this.server, lobbyId, playerSocketId);
            },
            onTurnEnded: (lobbyId: string, playerSocketId: string) => {
                this.server.to(lobbyId).emit(JoinGameEvents.TurnEnded, playerSocketId);
            },
        });
    }

    handleDisconnect(socket: Socket): void {
        this.processGameDisconnect(socket);
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        const finalLobby = this.lobbyService.canStartGame(lobbyId, socket.id);
        if (!finalLobby) {
            socket.emit(JoinGameEvents.LobbyError, 'Impossible de demarrer la partie. (Minimum 2 joueurs requis.)');
            return;
        }

        const activeGame = this.gameLogicService.initializeGame(finalLobby);

        this.server.to(lobbyId).emit(JoinGameEvents.GameStarting, activeGame.lobby);
        this.server.to(lobbyId).emit(JoinGameEvents.GameStarted, {
            lobby: activeGame.lobby,
            turnOrder: activeGame.turnOrder,
            playerPositions: this.gameLogicService.getPlayerPositions(lobbyId),
            playerStartPositions: activeGame.playerStartPositions,
        });

        this.gameLogicService.startTurnCycle(lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.RequestMove)
    handleRequestMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; direction: Direction }): void {
        const { lobbyId, direction } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result = this.gameLogicService.movePlayer(lobbyId, socket.id, direction);
        if (!result) return;

        const movementPoints = this.gameLogicService.getMovementPoints(lobbyId, socket.id);
        this.server.to(lobbyId).emit(JoinGameEvents.PlayerMoved, {
            socketId: socket.id,
            position: result.position,
            movementPoints,
            flagTaken: result.flagJustTaken,
        });

        this.gameTurnSyncService.refreshPlayerNavigationState(this.server, lobbyId, socket.id);

        if (this.lobbyService.getLobby(lobbyId).game.gameMode === GameMode.Ctf) {
            const winner = this.gameLogicService.checkWinCondition(lobbyId, socket.id, result.position);
            if (winner) {
                this.handleGameOver(lobbyId, winner.socketId);
            }
        }
    }

    @SubscribeMessage(JoinGameEvents.Teleport)
    handleTeleportMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; position: Vec2 }): void {
        const { lobbyId, position } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const newPosition = this.gameLogicService.teleportPlayer(lobbyId, socket.id, position);
        if (!newPosition) return;

        this.server.to(lobbyId).emit(JoinGameEvents.PlayerTeleported, {
            socketId: socket.id,
            position: newPosition.position,
            flagTaken: newPosition.flagJustTaken,
        });

        this.gameTurnSyncService.refreshPlayerNavigationState(this.server, lobbyId, socket.id);
    }

    @SubscribeMessage(JoinGameEvents.ToggleDebugMode)
    handleDebugToggle(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; state: boolean }): void {
        const { lobbyId, state } = payload;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame || activeGame.lobby.hostSocketId !== socket.id) return;

        activeGame.isDebugMode = !state;
        this.server.to(lobbyId).emit(JoinGameEvents.DebugToggled, !state);

        if (!activeGame.isDebugMode) {
            const currentSocketId = activeGame.turnOrder[activeGame.currentTurnIndex];
            if (currentSocketId) {
                this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, currentSocketId);
            }
        }
    }

    @SubscribeMessage(JoinGameEvents.EndTurn)
    handleEndTurn(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        if (activeGame.lobby.hostSocketId === socket.id || this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) {
            this.gameLogicService.endTurn(lobbyId);
        }
    }

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

        const session = this.combatSessions.get(roomId);
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

    @SubscribeMessage(JoinGameEvents.RequestCombat)
    handleRequestCombat(
        @ConnectedSocket() socket: Socket,
        @MessageBody() payload: { lobbyId: string; player: Player; enemy: Player },
    ): void {
        this.fightCounter++;
        const roomId = `fight${this.fightCounter}`;

        const { lobbyId, enemy } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const attacker = activeGame.lobby.players.find((player) => player.socketId === socket.id);
        const defender = activeGame.lobby.players.find((player) => player.socketId === enemy.socketId);
        if (!attacker || !defender) return;

        const enemySocket = socket.nsp.sockets.get(defender.socketId);
        if (!enemySocket) return;

        socket.join(roomId);
        enemySocket.join(roomId);

        const combatStartedData: CombatStartedData = { player: attacker, enemy: defender, roomId };
        this.server.to(roomId).emit(JoinGameEvents.CombatStarted, combatStartedData);

        const combatSession: CombatSession = {
            lobbyId,
            roomId,
            attackerId: socket.id,
            defenderId: defender.socketId,
            postures: new Map<string, Posture>(),
            roundIndex: 1,
            awaitingPostures: false,
            consumeActionPointOnNextRound: true,
        };

        this.combatSessions.set(roomId, combatSession);
        this.startCombatRoundAwaitingPostures(combatSession);
    }

    @SubscribeMessage(JoinGameEvents.GiveFlagRequest)
    handleGiveFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }): void {
        const { lobbyId, targetSocketId } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const requesterName = this.gameLogicService.getActiveGame(lobbyId)
            ?.lobby.players.find((player) => player.socketId === socket.id)?.character?.name ?? 'Un coéquipier';

        this.server.to(targetSocketId).emit(JoinGameEvents.GiveFlagResponse, {
            requesterId: socket.id,
            requesterName,
            lobbyId,
        });
    }

    @SubscribeMessage(JoinGameEvents.RequestFlagRequest)
    handleRequestFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }): void {
        const { lobbyId, targetSocketId } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const requesterName = this.gameLogicService.getActiveGame(lobbyId)
            ?.lobby.players.find((player) => player.socketId === socket.id)?.character?.name ?? 'Un coéquipier';

        this.server.to(targetSocketId).emit(JoinGameEvents.RequestFlagResponse, {
            requesterId: socket.id,
            requesterName,
            lobbyId,
        });
    }

    @SubscribeMessage(JoinGameEvents.FlagTransferResponse)
    handleFlagTransferResponse(
        @ConnectedSocket() socket: Socket,
        @MessageBody() payload: { lobbyId: string; requesterId: string; accepted: boolean; isRequest?: boolean },
    ): void {
        const { lobbyId, requesterId, accepted, isRequest } = payload;
        if (!accepted) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, requesterId)) return;

        if (!isRequest) {
            const wasFlagTransfered = this.gameLogicService.transferFlag(lobbyId, requesterId, socket.id, requesterId);
            if (!wasFlagTransfered) return;
            this.sendActionPoints(lobbyId, requesterId);
            this.server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, {
                giverPlayerId: requesterId,
                targetPlayerId: socket.id,
            });
        } else {
            const wasFlagTransfered = this.gameLogicService.transferFlag(lobbyId, socket.id, requesterId, requesterId);
            if (!wasFlagTransfered) return;
            this.sendActionPoints(lobbyId, requesterId);
            this.server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, {
                giverPlayerId: socket.id,
                targetPlayerId: requesterId,
            });
        }
    }

    @SubscribeMessage(JoinGameEvents.RequestTileInfo)
    handleRequestTileInfo(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; position: Vec2 }): void {
        const { lobbyId, position } = payload;
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const tile = activeGame.lobby.game.grid[position.y]?.[position.x];
        if (!tile) return;

        const playerOnTile = activeGame.lobby.players.find((player) => {
            const playerPos = activeGame.playerPositions.get(player.socketId);
            return playerPos && playerPos.x === position.x && playerPos.y === position.y && !player.hasAbandonned;
        });

        socket.emit(JoinGameEvents.TileInfo, {
            tile,
            cost: TILE_COSTS[tile.type],
            player: playerOnTile ? { name: playerOnTile.character.name, avatar: playerOnTile.character.avatar } : null,
        });
    }

    @SubscribeMessage(JoinGameEvents.PlayerAbandon)
    handlePlayerAbandon(@ConnectedSocket() socket: Socket): void {
        this.processGameDisconnect(socket);
        socket.emit(JoinGameEvents.LeftLobby);
    }

    private processGameDisconnect(socket: Socket): void {
        const activeGame = this.gameLogicService.findActiveGameBySocketId(socket.id);
        if (!activeGame) return;

        const combatSession = this.findCombatSessionByPlayer(socket.id);
        if (combatSession) {
            const winnerId = combatSession.attackerId === socket.id ? combatSession.defenderId : combatSession.attackerId;
            this.resolveCombatByAbandon(combatSession, socket.id, winnerId);
        }

        const isGameOver = this.gameLogicService.executePlayerAbandon(activeGame.lobby.lobbyId, socket, this.server);
        if (!isGameOver) return;

        const lobbyId = activeGame.lobby.lobbyId;
        const remainingPlayers = activeGame.lobby.players
            .filter((player) => !player.hasAbandonned)
            .map((player) => player.socketId);
        this.endGamePlayers.set(lobbyId, new Set(remainingPlayers));
    }

    private handleGameOver(lobbyId: string, winnerSocketId: string | null): void {
        const gameStats = this.gameLogicService.getGameStats(lobbyId);
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const players = activeGame ? [...activeGame.lobby.players] : [];
        const socketIds = new Set(players.map((player) => player.socketId));
        this.endGamePlayers.set(lobbyId, socketIds);

        this.server.to(lobbyId).emit(JoinGameEvents.GameOver, { winnerSocketId, isForfeit: false, players, gameStats });
        this.gameLogicService.endGame(lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.LeaveEndGame)
    handleLeaveEndGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        const remaining = this.endGamePlayers.get(lobbyId);
        if (!remaining) return;

        remaining.delete(socket.id);
        socket.leave(lobbyId);

        if (remaining.size > 0) return;
        this.endGamePlayers.delete(lobbyId);
        this.lobbyService.deleteLobby(lobbyId);
    }

    private autoEndTurnIfNoActions(lobbyId: string, socketId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (activeGame?.isDebugMode) return;

        const reachable = this.gameLogicService.getReachableTiles(lobbyId, socketId);
        const adjacent = this.gameLogicService.getAdjacentPlayers(lobbyId, socketId);
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);

        const canMove = reachable.length > 0;
        const canFight = adjacent.length > 0 && actionPoints > 0;

        if (!canMove && !canFight) this.gameLogicService.endTurn(lobbyId);
    }

    private resolveCombatSession(roomId: string, timedOutSocketIds: string[] = []): void {
        const session = this.combatSessions.get(roomId);
        if (!session || !session.awaitingPostures) return;

        this.clearCombatSessionTimers(session);

        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) {
            this.cleanupCombatSession(session.roomId);
            return;
        }

        const attacker = activeGame.lobby.players.find((player) => player.socketId === session.attackerId);
        const defender = activeGame.lobby.players.find((player) => player.socketId === session.defenderId);
        if (!attacker || !defender) {
            this.cleanupCombatSession(session.roomId);
            return;
        }

        attacker.character.bonusPosture = session.postures.get(session.attackerId) ?? { ...DEFAULT_POSTURE };
        defender.character.bonusPosture = session.postures.get(session.defenderId) ?? { ...DEFAULT_POSTURE };

        session.awaitingPostures = false;
        this.executeCombatRound(session.roomId, session.consumeActionPointOnNextRound, timedOutSocketIds);
    }

    private executeCombatRound(roomId: string, consumeActionPoint: boolean, timedOutSocketIds: string[] = []): void {
        const session = this.combatSessions.get(roomId);
        if (!session) return;

        const combatResult = this.gameLogicService.initiateCombat(
            session.lobbyId,
            session.attackerId,
            session.defenderId,
            consumeActionPoint,
        ) as CombatResult | null;

        if (!combatResult) {
            this.cleanupCombatSession(session.roomId);
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

        const isFightOver = combatResult.attacker.killed || combatResult.defender.killed;
        if (!isFightOver) {
            session.consumeActionPointOnNextRound = false;
            session.timeoutHandle = setTimeout(() => {
                this.prepareNextCombatRound(session.roomId);
            }, COMBAT_ROUND_DELAY_MS);
            return;
        }

        const combatEndedData: CombatEndedData = {
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
            attackerKilled: combatResult.attacker.killed,
            defenderKilled: combatResult.defender.killed,
            winnerId: combatResult.winnerId,
            reason: 'death',
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatEnded, combatEndedData);

        this.finalizeCombatSession(session, combatResult);
    }

    private prepareNextCombatRound(roomId: string): void {
        const session = this.combatSessions.get(roomId);
        if (!session) return;

        session.postures.clear();
        session.roundIndex++;
        session.awaitingPostures = false;
        this.startCombatRoundAwaitingPostures(session);
    }

    private finalizeCombatSession(session: CombatSession, finalResult: CombatResult): void {
        this.clearCombatSessionTimers(session);

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        if (winner) {
            this.handleGameOver(session.lobbyId, winner.socketId);
            this.cleanupCombatSession(session.roomId);
            return;
        }

        if (finalResult.winnerId === session.attackerId) {
            this.sendActionPoints(session.lobbyId, session.attackerId);
            this.autoEndTurnIfNoActions(session.lobbyId, session.attackerId);
        } else {
            this.gameLogicService.endTurn(session.lobbyId);
        }

        this.cleanupCombatSession(session.roomId);
    }

    private findCombatSessionByPlayer(socketId: string): CombatSession | undefined {
        return Array.from(this.combatSessions.values()).find((session) => session.attackerId === socketId || session.defenderId === socketId);
    }

    private resolveCombatByAbandon(session: CombatSession, loserId: string, winnerId: string): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        if (!activeGame) {
            this.cleanupCombatSession(session.roomId);
            return;
        }

        const winnerPlayer = activeGame.lobby.players.find((player) => player.socketId === winnerId);
        if (winnerPlayer && !winnerPlayer.hasAbandonned) winnerPlayer.winsCount++;

        const combatEndedData: CombatEndedData = {
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
            attackerKilled: loserId === session.attackerId,
            defenderKilled: loserId === session.defenderId,
            winnerId,
            reason: 'abandon',
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatEnded, combatEndedData);

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        if (winner) {
            this.handleGameOver(session.lobbyId, winner.socketId);
            this.cleanupCombatSession(session.roomId);
            return;
        }

        if (winnerId === session.attackerId) {
            this.sendActionPoints(session.lobbyId, session.attackerId);
            this.autoEndTurnIfNoActions(session.lobbyId, session.attackerId);
        }

        this.cleanupCombatSession(session.roomId);
    }

    private cleanupCombatSession(roomId: string): void {
        const session = this.combatSessions.get(roomId);
        if (session) this.clearCombatSessionTimers(session);
        this.server.in(roomId).socketsLeave(roomId);
        this.combatSessions.delete(roomId);
    }

    private normalizePosture(posture: Posture | null | undefined): Posture {
        const postureType = posture?.type === 'atk' || posture?.type === 'def' ? posture.type : null;
        if (!postureType) return { ...DEFAULT_POSTURE };
        return { type: postureType, bonus: 2 };
    }

    private startCombatRoundAwaitingPostures(session: CombatSession): void {
        this.clearCombatSessionTimers(session);
        session.awaitingPostures = true;

        const roundStartedData: CombatRoundStartedData = {
            roomId: session.roomId,
            roundIndex: session.roundIndex,
            postureTimeoutMs: COMBAT_POSTURE_TIMEOUT_MS,
        };
        this.server.to(session.roomId).emit(JoinGameEvents.CombatRoundStarted, roundStartedData);

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
                this.clearCombatSessionTimers(session);
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

    private clearCombatSessionTimers(session: CombatSession): void {
        if (session.timeoutHandle) {
            clearTimeout(session.timeoutHandle);
            session.timeoutHandle = undefined;
        }

        if (session.countdownHandle) {
            clearInterval(session.countdownHandle);
            session.countdownHandle = undefined;
        }
    }

    private sendActionPoints(lobbyId: string, socketId: string): void {
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ActionPoints, { socketId, actionPoints });
    }
}
