import { CombatSessionService } from '@app/gateways/combat/combat-session.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { JournalService } from '@app/services/journal/journal.service';
import { PlayerType, SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class FlagTransferGateway {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly combatSessionService: CombatSessionService,
        private readonly gameLogicService: GameLogicService,
        private readonly journalService: JournalService,
    ) {}

    @SubscribeMessage(JoinGameEvents.GiveFlagRequest)
    handleGiveFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }): void {
        const { lobbyId, targetSocketId } = payload;
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const requesterName = activeGame?.lobby.players.find((player) => player.socketId === socket.id)?.character?.name ?? 'Un coéquipier';

        // If the target is a virtual player, auto-accept the flag transfer on its behalf.
        const targetPlayer = activeGame?.lobby.players.find((p) => p.socketId === targetSocketId);
        if (targetPlayer?.playerType === PlayerType.Virtual) {
            this.autoAcceptFlagTransferForVirtualPlayer(lobbyId, targetSocketId, socket.id, false);
            return;
        }

        this.server.to(targetSocketId).emit(JoinGameEvents.GiveFlagResponse, {
            requesterId: socket.id,
            requesterName,
            lobbyId,
        });
    }

    @SubscribeMessage(JoinGameEvents.RequestFlagRequest)
    handleRequestFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; targetSocketId: string }): void {
        const { lobbyId, targetSocketId } = payload;
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        const requesterName = activeGame?.lobby.players.find((player) => player.socketId === socket.id)?.character?.name ?? 'Un coéquipier';

        // If the target is a virtual player, auto-accept the flag transfer
        const targetPlayer = activeGame?.lobby.players.find((p) => p.socketId === targetSocketId);
        if (targetPlayer?.playerType === PlayerType.Virtual) {
            this.autoAcceptFlagTransferForVirtualPlayer(lobbyId, targetSocketId, socket.id, true);
            return;
        }

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
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;
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

    // When a real player sends a flag-give or flag-request to a VP,
    // the gateway accepts it server-side instead of routing to a socket.
    // TODO: clarify the request
    private autoAcceptFlagTransferForVirtualPlayer(
        lobbyId: string,
        virtualPlayerSocketId: string,
        requesterId: string,
        isRequest: boolean,
    ): void {
        if (!this.gameLogicService.isPlayerTurn(lobbyId, requesterId)) return;

        let wasFlagTransfered: boolean;
        if (!isRequest) {
            // The requester (real player) wants to give the flag to the VP.
            wasFlagTransfered = this.gameLogicService.transferFlag(lobbyId, requesterId, virtualPlayerSocketId, requesterId);
        } else {
            // The requester (real player) wants the VP (flag holder) to hand it over.
            wasFlagTransfered = this.gameLogicService.transferFlag(lobbyId, virtualPlayerSocketId, requesterId, requesterId);
        }

        if (!wasFlagTransfered) return;

        const transferData = isRequest
            ? { giverPlayerId: virtualPlayerSocketId, targetPlayerId: requesterId }
            : { giverPlayerId: requesterId, targetPlayerId: virtualPlayerSocketId };

        this.server.to(lobbyId).emit(JoinGameEvents.FlagTransferred, transferData);
    }

    private sendActionPoints(lobbyId: string, socketId: string): void {
        const actionPoints = this.gameLogicService.getActionPoints(lobbyId, socketId);
        this.server.to(lobbyId).emit(JoinGameEvents.ActionPoints, { socketId, actionPoints });
    }
}
