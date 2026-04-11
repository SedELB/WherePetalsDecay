import { JournalService } from '@app/services/journal/journal.service';
import { JournalEntry } from '@common/journal-entry';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class JournalGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(private readonly journalService: JournalService) {}

    afterInit(): void {
        this.journalService.setOnEntryAdded((lobbyId: string, entry: JournalEntry) => {
            if (entry.isPrivate && entry.involvedPlayerIds.length > 0) {
                this.emitToInvolvedPlayers(lobbyId, entry);
            } else {
                this.server.to(lobbyId).emit(JoinGameEvents.JournalEntry, entry);
            }
        });
    }

    @SubscribeMessage(JoinGameEvents.JournalHistoryRequest)
    handleJournalHistoryRequest(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: string): void {

        const localSocketId = socket.id;
        const allEntries = this.journalService.getEntries(lobbyId);

        const visibleEntries = allEntries.filter(
            (entry) => !entry.isPrivate || entry.involvedPlayerIds.includes(localSocketId),
        );

        socket.emit(JoinGameEvents.JournalHistorySent, visibleEntries);
    }

    private emitToInvolvedPlayers(lobbyId: string, entry: JournalEntry): void {
        const sockets = this.server.in(lobbyId);

        sockets.fetchSockets().then((connectedSockets) => {
            for (const connectedSocket of connectedSockets) {
                if (entry.involvedPlayerIds.includes(connectedSocket.id)) {
                    connectedSocket.emit(JoinGameEvents.JournalEntry, entry);
                }
            }
        });
    }
}
