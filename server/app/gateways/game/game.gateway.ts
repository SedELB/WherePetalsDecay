import {
    FlagTransferResponsePayload,
    MoveRequestPayload,
    RequestTileInfoPayload,
    RequestToggleDoorPayload,
    RequestUseSanctuaryPayload,
    SendPosturePayload,
    TargetPlayerPayload,
    TeleportPayload,
    ToggleDebugPayload,
} from '@app/interfaces/gateway.interfaces';
import { CombatFlowService } from '@app/services/game-logic/core/combat-flow.service';
import { FlagTransferFlowService } from '@app/services/game-logic/core/flag-transfer-flow.service';
import { GameFlowService } from '@app/services/game-logic/core/game-flow.service';
import { MovementFlowService } from '@app/services/game-logic/core/movement-flow.service';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable, Logger } from '@nestjs/common';
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

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    @Inject(CombatFlowService) private readonly combatFlow: CombatFlowService;
    @Inject(FlagTransferFlowService) private readonly flagFlow: FlagTransferFlowService;

    constructor(
        private readonly logger: Logger,
        private readonly gameFlow: GameFlowService,
        private readonly movementFlow: MovementFlowService,
    ) {}

    afterInit(): void {
        this.logger.log('GameGateway initialized on /join namespace');
        this.gameFlow.initialize(this.server);
        this.movementFlow.setGameOverCallback((lobbyId, winnerId) => this.gameFlow.handleGameOver(lobbyId, winnerId));
    }

    handleDisconnect(socket: Socket): void {
        this.gameFlow.processGameDisconnect(socket);
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.gameFlow.startGame(socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.ToggleDebugMode)
    handleDebugToggle(@ConnectedSocket() socket: Socket, @MessageBody() payload: ToggleDebugPayload): void {
        this.gameFlow.toggleDebug(socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.EndTurn)
    handleEndTurn(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.gameFlow.endTurn(socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.PlayerAbandon)
    handlePlayerAbandon(@ConnectedSocket() socket: Socket): void {
        this.gameFlow.playerAbandon(socket);
    }

    @SubscribeMessage(JoinGameEvents.LeaveEndGame)
    handleLeaveEndGame(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.gameFlow.leaveEndGame(socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.RequestCombat)
    handleRequestCombat(@ConnectedSocket() socket: Socket, @MessageBody() payload: { lobbyId: string; enemy: { socketId: string } }): void {
        this.combatFlow.initializeCombat(this.server, payload.lobbyId, socket.id, payload.enemy.socketId);
    }

    @SubscribeMessage(JoinGameEvents.SendPosture)
    handlePostureReceived(@ConnectedSocket() socket: Socket, @MessageBody() payload: SendPosturePayload): void {
        this.combatFlow.handlePostureReceived(payload.roomId, socket.id, payload.posture);
    }

    @SubscribeMessage(JoinGameEvents.RequestMove)
    handleRequestMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: MoveRequestPayload): void {
        this.movementFlow.requestMove(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.Teleport)
    handleTeleportMove(@ConnectedSocket() socket: Socket, @MessageBody() payload: TeleportPayload): void {
        this.movementFlow.teleport(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.RequestTileInfo)
    handleRequestTileInfo(@ConnectedSocket() socket: Socket, @MessageBody() payload: RequestTileInfoPayload): void {
        this.movementFlow.requestTileInfo(socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.RequestToggleDoor)
    handleRequestToggleDoor(@ConnectedSocket() socket: Socket, @MessageBody() payload: RequestToggleDoorPayload): void {
        this.movementFlow.toggleDoor(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.RequestUseSanctuary)
    handleRequestUseSanctuary(@ConnectedSocket() socket: Socket, @MessageBody() payload: RequestUseSanctuaryPayload): void {
        this.movementFlow.useSanctuary(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.GiveFlagRequest)
    handleGiveFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: TargetPlayerPayload): void {
        this.flagFlow.giveFlag(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.RequestFlagRequest)
    handleRequestFlagRequest(@ConnectedSocket() socket: Socket, @MessageBody() payload: TargetPlayerPayload): void {
        this.flagFlow.requestFlag(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.FlagTransferResponse)
    handleFlagTransferResponse(@ConnectedSocket() socket: Socket, @MessageBody() payload: FlagTransferResponsePayload): void {
        this.flagFlow.respond(this.server, socket, payload);
    }
}
