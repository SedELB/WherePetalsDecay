/* eslint-disable max-lines */
import { GameLogicService, SanctuaryUseResult } from '@app/services/game-logic/game-logic.service';
import { JournalService } from '@app/services/journal/journal.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Posture } from '@common/character';
import { Direction } from '@common/direction';
import { GameMode, SocketNamespace, TileItem, TileTexture } from '@common/enums';
import {
    CombatEndedData,
    CombatLockStateData,
    CombatResult,
    CombatRoundCountdownData,
    CombatRoundResolvedData,
    CombatRoundStartedData,
    CombatStartedData,
    PostureReceivedData,
} from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { JournalEventType } from '@common/journal-entry';
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
import {
    COMBAT_POSTURE_COUNTDOWN_START_DELAY_MS,
    COMBAT_POSTURE_TIMEOUT_MS,
    COMBAT_ROUND_DELAY_MS,
    COMBAT_START_ANNOUNCEMENT_DELAY_MS,
    COUNTDOWN_TICK_MS,
    DEFAULT_POSTURE,
} from './game.gateway.constants';

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
    countdownStartHandle?: ReturnType<typeof setTimeout>;
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
        private readonly journalService: JournalService,
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
                this.server.to(lobbyId).emit(JoinGameEvents.SanctuaryStateUpdate, {
                    inactiveSanctuaries: this.gameLogicService.getInactiveSanctuaries(lobbyId),
                });

                const activeGame = this.gameLogicService.getActiveGame(lobbyId);
                const playerName = activeGame?.lobby.players.find((p) => p.socketId === playerSocketId)?.character?.name ?? 'Joueur inconnu';
                this.journalService.addTurnStartEntry(lobbyId, playerName);
            },
            onTurnEnded: (lobbyId: string, playerSocketId: string) => {
                const expiredBonusPlayers = this.gameLogicService.decrementSanctuaryCooldowns(lobbyId, playerSocketId);
                for (const sid of expiredBonusPlayers) {
                    const game = this.gameLogicService.getActiveGame(lobbyId);
                    const player = game?.lobby.players.find((p) => p.socketId === sid);
                    if (player) {
                        this.server.to(lobbyId).emit(JoinGameEvents.PlayerStatsUpdate, {
                            socketId: sid,
                            attack: player.character.attack,
                            defense: player.character.defense,
                            life: player.character.life,
                        });
                    }
                }
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
        if (this.hasActiveCombatInLobby(lobbyId)) return;
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

        this.handlePostMoveJournalEntries(lobbyId, socket.id, result.position, result.flagJustTaken);

        this.gameTurnSyncService.refreshPlayerNavigationState(this.server, lobbyId, socket.id);

        if (this.lobbyService.getLobby(lobbyId).game.gameMode === GameMode.Ctf) {
            const winner = this.gameLogicService.checkWinCondition(lobbyId, socket.id, result.position);
            if (winner) {
                this.handleGameOver(lobbyId, winner.socketId);
            }
        }
    }

    private handlePostMoveJournalEntries(lobbyId: string, socketId: string, position: Vec2, flagJustTaken: boolean): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const playerName = activeGame.lobby.players.find((p) => p.socketId === socketId)?.character?.name ?? 'Joueur';

        if (flagJustTaken) {
            this.journalService.addFlagPickedUpEntry(lobbyId, playerName);
        }

        const tile = activeGame.lobby.game.grid[position.y]?.[position.x];
        if (tile?.type === TileTexture.DoorOpened) {
            this.journalService.addDoorOpenEntry(lobbyId, playerName);
        }
        if (tile?.item === TileItem.HealingSanctuary || tile?.item === TileItem.CombatSanctuary) {
            this.journalService.addSanctuaryUsedEntry(lobbyId, playerName);
        }
    }

    @SubscribeMessage(JoinGameEvents.Teleport)
    handleTeleportMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; position: Vec2 }): void {
        const { lobbyId, position } = payload;
        if (this.hasActiveCombatInLobby(lobbyId)) return;
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

        const hostName = activeGame.lobby.players.find((p) => p.socketId === socket.id)?.character?.name ?? 'Hôte';
        this.journalService.addDebugToggleEntry(lobbyId, hostName, activeGame.isDebugMode);

        if (!activeGame.isDebugMode) {
            const currentSocketId = activeGame.turnOrder[activeGame.currentTurnIndex];
            if (currentSocketId) {
                this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, currentSocketId);
            }
        }
    }

    @SubscribeMessage(JoinGameEvents.EndTurn)
    handleEndTurn(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        if (this.hasActiveCombatInLobby(lobbyId)) return;

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

        const allPosturesReceived = session.postures.has(session.attackerId) && session.postures.has(session.defenderId);
        if (allPosturesReceived) {
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
        if (this.hasActiveCombatInLobby(lobbyId)) return;
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
        this.gameLogicService.pauseTurnCycle(lobbyId);
        this.emitCombatLockState({
            lobbyId,
            isLocked: true,
            roomId,
            attackerSocketId: socket.id,
            defenderSocketId: defender.socketId,
        });

        const combatStartedData: CombatStartedData = { player: attacker, enemy: defender, roomId };
        this.server.to(roomId).emit(JoinGameEvents.CombatStarted, combatStartedData);
        this.journalService.addCombatStartEntry(lobbyId, attacker.character.name, defender.character.name);

        combatSession.timeoutHandle = setTimeout(() => {
            const activeSession = this.combatSessions.get(roomId);
            if (!activeSession) return;
            this.startCombatRoundAwaitingPostures(activeSession);
        }, COMBAT_START_ANNOUNCEMENT_DELAY_MS);
    }

    @SubscribeMessage(JoinGameEvents.GiveFlagRequest)
    handleGiveFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }): void {
        const { lobbyId, targetSocketId } = payload;
        if (this.hasActiveCombatInLobby(lobbyId)) return;
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
        if (this.hasActiveCombatInLobby(lobbyId)) return;
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
        if (this.hasActiveCombatInLobby(lobbyId)) return;
        if (!accepted) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, requesterId)) return;

        if (!isRequest) {
            this.executeFlagTransfer(lobbyId, requesterId, socket.id, requesterId);
        } else {
            this.executeFlagTransfer(lobbyId, socket.id, requesterId, requesterId);
        }
    }

    private executeFlagTransfer(lobbyId: string, giverId: string, receiverId: string, actionPointUpdaterId: string): void {
        const wasFlagTransfered = this.gameLogicService.transferFlag(lobbyId, giverId, receiverId, actionPointUpdaterId);
        if (!wasFlagTransfered) return;

        this.sendActionPoints(lobbyId, actionPointUpdaterId);
        this.server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, {
            giverPlayerId: giverId,
            targetPlayerId: receiverId,
        });

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const giverName = activeGame?.lobby.players.find((p) => p.socketId === giverId)?.character?.name ?? 'Joueur';
        const receiverName = activeGame?.lobby.players.find((p) => p.socketId === receiverId)?.character?.name ?? 'Joueur';
        this.journalService.addFlagTransferEntry(lobbyId, giverName, receiverName);
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

    @SubscribeMessage(JoinGameEvents.RequestToggleDoor) handleRequestToggleDoor(
        @ConnectedSocket() socket: Socket,
        @MessageBody() payload: { lobbyId: string; position: Vec2 },
    ) {
        const { lobbyId, position } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result = this.gameLogicService.toggleDoor(lobbyId, socket.id, position);
        if (!result) return;

        const game = this.gameLogicService.getActiveGame(lobbyId);
        this.server.to(lobbyId).emit(JoinGameEvents.DoorToggled, {
            position,
            newType: game.lobby.game.grid[position.y][position.x].type,
        });

        this.sendActionPoints(lobbyId, socket.id);
        this.autoEndTurnIfNoActions(lobbyId, socket.id);
    }
    @SubscribeMessage(JoinGameEvents.RequestUseSanctuary)
    handleRequestUseSanctuary(
        @ConnectedSocket() socket: Socket,
        @MessageBody() payload: { lobbyId: string; position: { x: number; y: number }; mode: 'normal' | 'doubleOrNothing' },
    ) {
        const { lobbyId, position, mode } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result: SanctuaryUseResult = this.gameLogicService.useSanctuary(lobbyId, socket.id, position, mode);
        if (!result) return;

        const game = this.gameLogicService.getActiveGame(lobbyId);
        const player = game?.lobby.players.find((p) => p.socketId === socket.id);

        this.server.to(lobbyId).emit(JoinGameEvents.SanctuaryUsed, {
            socketId: socket.id,
            position,
            sanctuaryType: result.sanctuaryType,
            mode: result.mode,
            healAmount: result.healAmount,
            combatBonusApplied: result.combatBonusApplied,
            playerNewLife: result.playerNewLife,
            playerName: result.playerName,
            inactiveSanctuaries: result.inactiveSanctuaries,
        });

        if (result.combatBonusApplied && player) {
            this.server.to(lobbyId).emit(JoinGameEvents.PlayerStatsUpdate, {
                socketId: socket.id,
                attack: player.character.attack,
                defense: player.character.defense,
                life: player.character.life,
            });
        }

        const sanctuaryLabel = result.sanctuaryType === TileItem.HealingSanctuary ? 'soin' : 'combat';
        const modeLabel = mode === 'doubleOrNothing' ? ' (double ou rien)' : '';
        this.server.to(lobbyId).emit(JoinGameEvents.JournalEntry,
            `${result.playerName} a utilisé un sanctuaire de ${sanctuaryLabel}${modeLabel}.`,
        );

        this.sendActionPoints(lobbyId, socket.id);
        this.autoEndTurnIfNoActions(lobbyId, socket.id);
    }

    @SubscribeMessage(JoinGameEvents.PlayerAbandon)
    handlePlayerAbandon(@ConnectedSocket() socket: Socket): void {
        this.processGameDisconnect(socket);
        socket.emit(JoinGameEvents.LeftLobby);
    }

    private processGameDisconnect(socket: Socket): void {
        const activeGame = this.gameLogicService.findActiveGameBySocketId(socket.id);
        if (!activeGame) return;

        const lobbyId = activeGame.lobby.lobbyId;
        const abandoningPlayer = activeGame.lobby.players.find((p) => p.socketId === socket.id);
        if (abandoningPlayer) {
            this.journalService.addPlayerAbandonEntry(lobbyId, abandoningPlayer.character.name);
        }

        const combatSession = this.findCombatSessionByPlayer(socket.id);
        if (combatSession) {
            const winnerId = combatSession.attackerId === socket.id ? combatSession.defenderId : combatSession.attackerId;
            this.resolveCombatByAbandon(combatSession, socket.id, winnerId);
        }

        const isGameOver = this.gameLogicService.executePlayerAbandon(lobbyId, socket, this.server);
        if (!isGameOver) return;

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

        const activeNames = players.filter((p) => !p.hasAbandonned).map((p) => p.character.name);
        this.journalService.addGameOverEntry(lobbyId, activeNames);

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
            this.emitCombatLockState({
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
            this.cleanupCombatSession(session.roomId);
            return;
        }

        const attacker = activeGame.lobby.players.find((player) => player.socketId === session.attackerId);
        const defender = activeGame.lobby.players.find((player) => player.socketId === session.defenderId);
        if (!attacker || !defender) {
            this.emitCombatLockState({
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
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
            this.emitCombatLockState({
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
            this.gameLogicService.resumeTurnCycle(session.lobbyId);
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

        this.emitCombatJournalEntries(session, combatResult);

        const isFightOver = combatResult.attacker.killed || combatResult.defender.killed;
        if (!isFightOver) {
            session.consumeActionPointOnNextRound = false;
            session.timeoutHandle = setTimeout(() => {
                this.prepareNextCombatRound(session.roomId);
            }, COMBAT_ROUND_DELAY_MS);
            return;
        }

        this.handleCombatEnd(session, combatResult);
    }

    private handleCombatEnd(session: CombatSession, combatResult: CombatResult): void {
        const activeGame = this.gameLogicService.getActiveGame(session.lobbyId);
        const attackerName = activeGame?.lobby.players.find((p) => p.socketId === session.attackerId)?.character?.name ?? 'Attaquant';
        const defenderName = activeGame?.lobby.players.find((p) => p.socketId === session.defenderId)?.character?.name ?? 'Défenseur';
        const winnerName = combatResult.winnerId === session.attackerId ? attackerName : defenderName;
        const loserName = combatResult.winnerId === session.attackerId ? defenderName : attackerName;
        this.journalService.addCombatEndEntry(session.lobbyId, winnerName, loserName);

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
        this.emitCombatLockState({
            lobbyId: session.lobbyId,
            isLocked: false,
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
        });

        const winner = this.gameLogicService.checkWinCondition(session.lobbyId);
        if (winner) {
            this.handleGameOver(session.lobbyId, winner.socketId);
            this.cleanupCombatSession(session.roomId);
            return;
        }

        if (finalResult.winnerId === session.attackerId) {
            this.gameLogicService.resumeTurnCycle(session.lobbyId);
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
            this.emitCombatLockState({
                lobbyId: session.lobbyId,
                isLocked: false,
                roomId: session.roomId,
                attackerSocketId: session.attackerId,
                defenderSocketId: session.defenderId,
            });
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
        this.emitCombatLockState({
            lobbyId: session.lobbyId,
            isLocked: false,
            roomId: session.roomId,
            attackerSocketId: session.attackerId,
            defenderSocketId: session.defenderId,
        });

        if (winner) {
            this.handleGameOver(session.lobbyId, winner.socketId);
            this.cleanupCombatSession(session.roomId);
            return;
        }

        if (winnerId === session.attackerId) {
            this.gameLogicService.resumeTurnCycle(session.lobbyId);
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

    private hasActiveCombatInLobby(lobbyId: string): boolean {
        return Array.from(this.combatSessions.values()).some((session) => session.lobbyId === lobbyId);
    }

    private emitCombatLockState(data: CombatLockStateData): void {
        this.server.to(data.lobbyId).emit(JoinGameEvents.CombatLockStateChanged, data);
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
            postureCountdownDelayMs: COMBAT_POSTURE_COUNTDOWN_START_DELAY_MS,
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

        const startCountdown = () => {
            if (!session.awaitingPostures) return;

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
        };

        session.countdownStartHandle = setTimeout(() => {
            session.countdownStartHandle = undefined;
            startCountdown();
        }, COMBAT_POSTURE_COUNTDOWN_START_DELAY_MS);

        session.timeoutHandle = setTimeout(() => {
            if (!session.awaitingPostures) return;

            const timedOutSocketIds = [session.attackerId, session.defenderId].filter((socketId) => !session.postures.has(socketId));
            for (const socketId of timedOutSocketIds) {
                session.postures.set(socketId, { ...DEFAULT_POSTURE });
            }

            this.resolveCombatSession(session.roomId, timedOutSocketIds);
        }, COMBAT_POSTURE_TIMEOUT_MS + COMBAT_POSTURE_COUNTDOWN_START_DELAY_MS);
    }

    private clearCombatSessionTimers(session: CombatSession): void {
        if (session.timeoutHandle) {
            clearTimeout(session.timeoutHandle);
            session.timeoutHandle = undefined;
        }

        if (session.countdownStartHandle) {
            clearTimeout(session.countdownStartHandle);
            session.countdownStartHandle = undefined;
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
