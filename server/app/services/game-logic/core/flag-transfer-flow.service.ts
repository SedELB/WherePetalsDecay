import { FlagTransferResponsePayload, TargetPlayerPayload } from '@app/interfaces/gateway.interfaces';
import { CombatStateService } from '@app/services/game-logic/core/combat-state.service';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { GameTurnSyncService } from '@app/services/game-logic/core/game-turn-sync.service';
import { JournalService } from '@app/services/journal/journal.service';
import { PlayerType } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class FlagTransferFlowService {
    @Inject() private readonly combatState: CombatStateService;
    @Inject() private readonly gameLogicService: GameLogicService;
    @Inject() private readonly gameTurnSyncService: GameTurnSyncService;
    @Inject() private readonly journalService: JournalService;

    giveFlag(server: Server, socket: Socket, payload: TargetPlayerPayload): void {
        const { lobbyId, targetSocketId } = payload;
        if (!this.canTransfer(lobbyId, socket.id)) return;

        const requesterName = this.gameLogicService.getPlayerName(lobbyId, socket.id, 'Un coéquipier');
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const targetPlayer = activeGame?.lobby.players.find((p) => p.socketId === targetSocketId);

        if (targetPlayer?.playerType === PlayerType.Virtual) {
            this.autoAcceptForVirtualPlayer(server, lobbyId, targetSocketId, socket.id, false);
            return;
        }

        server.to(targetSocketId).emit(JoinGameEvents.GiveFlagResponse, { requesterId: socket.id, requesterName, lobbyId });
    }

    requestFlag(server: Server, socket: Socket, payload: TargetPlayerPayload): void {
        const { lobbyId, targetSocketId } = payload;
        if (!this.canTransfer(lobbyId, socket.id)) return;

        const requesterName = this.gameLogicService.getPlayerName(lobbyId, socket.id, 'Un coéquipier');
        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const targetPlayer = activeGame?.lobby.players.find((p) => p.socketId === targetSocketId);

        if (targetPlayer?.playerType === PlayerType.Virtual) {
            this.autoAcceptForVirtualPlayer(server, lobbyId, targetSocketId, socket.id, true);
            return;
        }

        server.to(targetSocketId).emit(JoinGameEvents.RequestFlagResponse, { requesterId: socket.id, requesterName, lobbyId });
    }

    respond(server: Server, socket: Socket, payload: FlagTransferResponsePayload): void {
        const { lobbyId, requesterId, accepted, isRequest } = payload;
        if (this.combatState.hasActiveCombatInLobby(lobbyId)) return;
        if (!accepted) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, requesterId)) return;

        const giverPlayerId = isRequest ? socket.id : requesterId;
        const targetPlayerId = isRequest ? requesterId : socket.id;
        this.execute(server, lobbyId, giverPlayerId, targetPlayerId, requesterId);
    }

    private canTransfer(lobbyId: string, socketId: string): boolean {
        if (this.combatState.hasActiveCombatInLobby(lobbyId)) return false;
        return this.gameLogicService.isPlayerTurn(lobbyId, socketId);
    }

    private execute(server: Server, lobbyId: string, giverPlayerId: string, targetPlayerId: string, payerId: string): void {
        const wasFlagTransfered = this.gameLogicService.transferFlag({ lobbyId, giverPlayerId, targetPlayerId, payerId });
        if (!wasFlagTransfered) return;

        this.gameTurnSyncService.emitActionPoints(server, lobbyId, payerId);
        server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, { giverPlayerId, targetPlayerId });

        const giverName = this.gameLogicService.getPlayerName(lobbyId, giverPlayerId);
        const receiverName = this.gameLogicService.getPlayerName(lobbyId, targetPlayerId);
        this.journalService.addFlagTransferEntry(lobbyId, giverName, receiverName);
    }

    private autoAcceptForVirtualPlayer(
        server: Server,
        lobbyId: string,
        virtualPlayerSocketId: string,
        requesterId: string,
        isRequest: boolean,
    ): void {
        if (!this.gameLogicService.isPlayerTurn(lobbyId, requesterId)) return;

        const giverPlayerId = isRequest ? virtualPlayerSocketId : requesterId;
        const targetPlayerId = isRequest ? requesterId : virtualPlayerSocketId;

        const wasFlagTransfered = this.gameLogicService.transferFlag({ lobbyId, giverPlayerId, targetPlayerId, payerId: requesterId });
        if (!wasFlagTransfered) return;

        server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, { giverPlayerId, targetPlayerId });
    }
}
