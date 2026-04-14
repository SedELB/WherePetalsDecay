import { CombatSessionService } from '@app/gateways/combat/combat-session.service';
import { GameTurnSyncService } from '@app/gateways/game/game-turn-sync.service';
import { GameLogicService, SanctuaryUseResult } from '@app/services/game-logic/game-logic.service';
import { JournalService } from '@app/services/journal/journal.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Direction } from '@common/direction';
import { GameMode, SocketNamespace, TileItem, TileTexture } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type HandleGameOverFn = (lobbyId: string, winnerSocketId: string | null) => void;

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class MovementGateway {
    @WebSocketServer() private server: Server;

    private handleGameOverCallback: HandleGameOverFn | null = null;

    constructor(
        private readonly combatSessionService: CombatSessionService,
        private readonly gameLogicService: GameLogicService,
        private readonly gameTurnSyncService: GameTurnSyncService,
        private readonly lobbyService: LobbyService,
        private readonly journalService: JournalService,
    ) {}

    setHandleGameOverCallback(callback: HandleGameOverFn): void {
        this.handleGameOverCallback = callback;
    }

    @SubscribeMessage(JoinGameEvents.RequestMove)
    handleRequestMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; direction: Direction }): void {
        const { lobbyId, direction } = payload;
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;
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
                this.handleGameOverCallback?.(lobbyId, winner.socketId);
            }
        }
    }

    @SubscribeMessage(JoinGameEvents.Teleport)
    handleTeleportMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; position: Vec2 }): void {
        const { lobbyId, position } = payload;
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;
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

    private sendActionPoints(lobbyId: string, socketId: string): void {
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ActionPoints, { socketId, actionPoints });
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
}
