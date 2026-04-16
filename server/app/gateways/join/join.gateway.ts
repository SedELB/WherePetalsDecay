import { ChatFlowService, ChatMessagePayload } from '@app/services/game-logic/core/chat-flow.service';
import { JoinFlowService } from '@app/services/game-logic/core/join-flow.service';
import { JournalBroadcastService } from '@app/services/game-logic/core/journal-broadcast.service';
import {
    AddVirtualPlayerPayload,
    CreateLobbyPayload,
    JoinLobbyPayload,
    SelectAvatarPayload,
    TargetPlayerPayload,
} from '@app/interfaces/gateway.interfaces';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class JoinGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    @Inject(ChatFlowService) private readonly chatFlow: ChatFlowService;
    @Inject(JournalBroadcastService) private readonly journalBroadcast: JournalBroadcastService;

    constructor(
        private readonly logger: Logger,
        private readonly joinFlow: JoinFlowService,
    ) {}

    afterInit(): void {
        this.logger.log('JoinGateway initialized on /join namespace');
        this.journalBroadcast.initialize(this.server);
    }

    handleConnection(socket: Socket): void {
        this.logger.log(`Player client connected: ${socket.id}`);
    }

    handleDisconnect(socket: Socket): void {
        this.joinFlow.processPlayerLeave(this.server, socket);
    }

    @SubscribeMessage(JoinGameEvents.LeaveLobby)
    handleLeaveLobby(@ConnectedSocket() socket: Socket): void {
        this.joinFlow.processPlayerLeave(this.server, socket);
    }

    @SubscribeMessage(JoinGameEvents.CreateLobby)
    handleCreateLobby(@ConnectedSocket() socket: Socket, @MessageBody() payload: CreateLobbyPayload): void {
        this.joinFlow.createLobby(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.GetLobbies)
    handleGetLobbies(): void {
        this.joinFlow.emitAvailableLobbies(this.server);
    }

    @SubscribeMessage(JoinGameEvents.StartGame)
    handleStartGameLobbiesRefresh(): void {
        this.joinFlow.deferLobbiesRefresh(this.server);
    }

    @SubscribeMessage(JoinGameEvents.LeaveEndGame)
    handleLeaveEndGameLobbiesRefresh(): void {
        this.joinFlow.deferLobbiesRefresh(this.server);
    }

    @SubscribeMessage(JoinGameEvents.JoinLobby)
    handleJoinLobby(@ConnectedSocket() socket: Socket, @MessageBody() payload: JoinLobbyPayload): void {
        this.joinFlow.joinLobby(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.GetLobbyStatus)
    handleGetStatus(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId?: string): void {
        this.joinFlow.getStatus(socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.SelectAvatar)
    handleSelectAvatar(@ConnectedSocket() socket: Socket, @MessageBody() payload: SelectAvatarPayload): void {
        this.joinFlow.selectAvatar(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.JoinAvatarRoom)
    handleJoinAvatarRoom(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.joinFlow.joinAvatarRoom(socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.ToggleLock)
    handleToggleLock(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.joinFlow.toggleLock(this.server, socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.KickPlayer)
    handleKickPlayer(@ConnectedSocket() socket: Socket, @MessageBody() payload: TargetPlayerPayload): void {
        this.joinFlow.kickPlayer(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.AddVirtualPlayer)
    handleAddVirtualPlayer(@ConnectedSocket() socket: Socket, @MessageBody() payload: AddVirtualPlayerPayload): void {
        this.joinFlow.addVirtualPlayer(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.ChatSendMessage)
    handleChatMessage(@ConnectedSocket() socket: Socket, @MessageBody() payload: ChatMessagePayload): void {
        this.chatFlow.handleMessage(this.server, socket, payload);
    }

    @SubscribeMessage(JoinGameEvents.ChatHistoryRequest)
    handleChatHistoryRequest(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.chatFlow.handleHistoryRequest(socket, lobbyId);
    }

    @SubscribeMessage(JoinGameEvents.JournalHistoryRequest)
    handleJournalHistoryRequest(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {
        this.journalBroadcast.handleHistoryRequest(socket, lobbyId);
    }
}
