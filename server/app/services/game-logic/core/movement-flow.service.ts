import {
    MoveRequestPayload,
    RequestTileInfoPayload,
    RequestToggleDoorPayload,
    RequestUseSanctuaryPayload,
    TeleportPayload,
} from '@app/interfaces/gateway.interfaces';
import { CombatStateService } from '@app/services/game-logic/core/combat-state.service';
import { GameLogicService, SanctuaryUseResult } from '@app/services/game-logic/core/game-logic.service';
import { GameTurnSyncService } from '@app/services/game-logic/core/game-turn-sync.service';
import { JournalService } from '@app/services/journal/journal.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { GameMode, TileTexture } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export type GameOverCallback = (lobbyId: string, winnerSocketId: string | null) => void;

@Injectable()
export class MovementFlowService {
    @Inject(LobbyService) private readonly lobbyService: LobbyService;
    @Inject(JournalService) private readonly journalService: JournalService;

    private onGameOverCallback: GameOverCallback | null = null;

    constructor(
        private readonly combatState: CombatStateService,
        private readonly gameLogicService: GameLogicService,
        private readonly gameTurnSyncService: GameTurnSyncService,
    ) {}

    setGameOverCallback(callback: GameOverCallback): void {
        this.onGameOverCallback = callback;
    }

    requestMove(server: Server, socket: Socket, payload: MoveRequestPayload): void {
        const { lobbyId, direction } = payload;
        if (this.combatState.hasActiveCombatInLobby(lobbyId)) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result = this.gameLogicService.movePlayer(lobbyId, socket.id, direction);
        if (!result) return;

        const movementPoints = this.gameLogicService.getMovementPoints(lobbyId, socket.id);
        server.to(lobbyId).emit(JoinGameEvents.PlayerMoved, {
            socketId: socket.id,
            position: result.position,
            movementPoints,
            flagTaken: result.flagJustTaken,
        });

        this.addPostMoveJournalEntries(lobbyId, socket.id, result.position, result.flagJustTaken);
        this.gameTurnSyncService.refreshPlayerNavigationState(server, lobbyId, socket.id);

        if (this.lobbyService.getLobby(lobbyId).game.gameMode === GameMode.Ctf) {
            const winner = this.gameLogicService.checkWinCondition(lobbyId, socket.id, result.position);
            if (winner) this.onGameOverCallback?.(lobbyId, winner.socketId);
        }
    }

    teleport(server: Server, socket: Socket, payload: TeleportPayload): void {
        const { lobbyId, position } = payload;
        if (this.combatState.hasActiveCombatInLobby(lobbyId)) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const newPosition = this.gameLogicService.teleportPlayer(lobbyId, socket.id, position);
        if (!newPosition) return;

        server.to(lobbyId).emit(JoinGameEvents.PlayerTeleported, {
            socketId: socket.id,
            position: newPosition.position,
            flagTaken: newPosition.flagJustTaken,
        });
        this.gameTurnSyncService.refreshPlayerNavigationState(server, lobbyId, socket.id);
    }

    requestTileInfo(socket: Socket, payload: RequestTileInfoPayload): void {
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

    toggleDoor(server: Server, socket: Socket, payload: RequestToggleDoorPayload): void {
        const { lobbyId, position } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result = this.gameLogicService.toggleDoor(lobbyId, socket.id, position);
        if (!result) return;

        const game = this.gameLogicService.getActiveGame(lobbyId);
        server.to(lobbyId).emit(JoinGameEvents.DoorToggled, {
            position,
            newType: game.lobby.game.grid[position.y][position.x].type,
        });

        const playerName = this.gameLogicService.getPlayerName(lobbyId, socket.id);
        if (result === TileTexture.DoorOpened) {
            this.journalService.addDoorOpenEntry(lobbyId, playerName);
        } else if (result === TileTexture.DoorClosed) {
            this.journalService.addDoorCloseEntry(lobbyId, playerName);
        }

        this.gameTurnSyncService.emitActionPoints(server, lobbyId, socket.id);
        this.gameTurnSyncService.refreshPlayerNavigationState(server, lobbyId, socket.id);
    }

    useSanctuary(server: Server, socket: Socket, payload: RequestUseSanctuaryPayload): void {
        const { lobbyId, position, mode } = payload;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const result: SanctuaryUseResult = this.gameLogicService.useSanctuary(lobbyId, socket.id, position, mode);
        if (!result) return;

        const game = this.gameLogicService.getActiveGame(lobbyId);
        const player = game?.lobby.players.find((p) => p.socketId === socket.id);

        server.to(lobbyId).emit(JoinGameEvents.SanctuaryUsed, {
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
            server.to(lobbyId).emit(JoinGameEvents.PlayerStatsUpdate, {
                socketId: socket.id,
                attack: player.character.attack,
                defense: player.character.defense,
                life: player.character.life,
            });
        }

        this.journalService.addSanctuaryUsedEntry(lobbyId, result.playerName, {
            sanctuaryType: result.sanctuaryType,
            mode: result.mode,
            healAmount: result.healAmount,
            combatBonusApplied: result.combatBonusApplied,
        });

        this.gameTurnSyncService.emitActionPoints(server, lobbyId, socket.id);
        this.gameTurnSyncService.autoEndTurnIfNoActions(lobbyId, socket.id);
    }

    private addPostMoveJournalEntries(lobbyId: string, socketId: string, position: Vec2, flagJustTaken: boolean): void {
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const playerName = this.gameLogicService.getPlayerName(lobbyId, socketId);
        if (flagJustTaken) this.journalService.addFlagPickedUpEntry(lobbyId, playerName);
    }
}
