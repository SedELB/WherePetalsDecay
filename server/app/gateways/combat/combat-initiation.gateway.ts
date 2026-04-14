import { CombatRoundGateway } from '@app/gateways/combat/combat-round.gateway';
import { CombatSession, CombatSessionService } from '@app/gateways/combat/combat-session.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { JournalService } from '@app/services/journal/journal.service';
import { Posture } from '@common/character';
import { PlayerType, SocketNamespace } from '@common/enums';
import { CombatStartedData } from '@common/interfaces/game-view';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Player } from '@common/player';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: SocketNamespace.Join, cors: true })
@Injectable()
export class CombatInitiationGateway {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly combatSessionService: CombatSessionService,
        @Inject(forwardRef(() => CombatRoundGateway))
        private readonly combatRoundGateway: CombatRoundGateway,
        private readonly gameLogicService: GameLogicService,
        private readonly journalService: JournalService,
    ) {}

    @SubscribeMessage(JoinGameEvents.RequestCombat)
    handleRequestCombat(
        @ConnectedSocket() socket: Socket,
        @MessageBody() payload: { lobbyId: string; player: Player; enemy: Player },
    ): void {
        const fightNum = this.combatSessionService.incrementFightCounter();
        const roomId = `fight${fightNum}`;

        const { lobbyId, enemy } = payload;
        if (this.combatSessionService.hasActiveCombatInLobby(lobbyId)) return;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, socket.id)) return;

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const attacker = activeGame.lobby.players.find((player) => player.socketId === socket.id);
        const defender = activeGame.lobby.players.find((player) => player.socketId === enemy.socketId);
        if (!attacker || !defender) return;

        socket.join(roomId);

        // Virtual players have no real socket – only join the room for real defenders.
        const isDefenderVirtualPlayer = defender.playerType === PlayerType.Virtual;
        if (!isDefenderVirtualPlayer) {
            const enemySocket = socket.nsp.sockets.get(defender.socketId);
            if (!enemySocket) return;
            enemySocket.join(roomId);
        }

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

        this.combatSessionService.createSession(combatSession);
        this.gameLogicService.pauseTurnCycle(lobbyId);
        this.server.to(lobbyId).emit(JoinGameEvents.CombatLockStateChanged, {
            lobbyId,
            isLocked: true,
            roomId,
            attackerSocketId: socket.id,
            defenderSocketId: defender.socketId,
        });

        const combatStartedData: CombatStartedData = { player: attacker, enemy: defender, roomId };
        this.server.to(roomId).emit(JoinGameEvents.CombatStarted, combatStartedData);
        this.journalService.addCombatStartEntry(lobbyId, attacker.character.name, defender.character.name);
        this.combatRoundGateway.startCombatRoundAwaitingPostures(combatSession);
    }

    // Entry-point for server-side VP-initiated combat
    // Called by VirtualPlayerService instead of emitting raw socket events
    initiateVirtualPlayerCombat(lobbyId: string, attackerId: string, defenderId: string): void {
        const fightNum = this.combatSessionService.incrementFightCounter();
        const roomId = `fight-vp-${fightNum}`;

        const activeGame = this.gameLogicService.getActiveGame(lobbyId);
        if (!activeGame) return;

        const attacker = activeGame.lobby.players.find((p) => p.socketId === attackerId);
        const defender = activeGame.lobby.players.find((p) => p.socketId === defenderId);
        if (!attacker || !defender) return;

        // If the defender has a real socket, add it to the fight room
        this.server.in(defenderId).socketsJoin(roomId);

        const combatStartedData: CombatStartedData = { player: attacker, enemy: defender, roomId };
        this.server.to(roomId).emit(JoinGameEvents.CombatStarted, combatStartedData);
        this.journalService.addCombatStartEntry(lobbyId, attacker.character.name, defender.character.name);

        const combatSession: CombatSession = {
            lobbyId,
            roomId,
            attackerId,
            defenderId,
            postures: new Map<string, Posture>(),
            roundIndex: 1,
            awaitingPostures: false,
            consumeActionPointOnNextRound: true,
        };

        this.combatSessionService.createSession(combatSession);
        this.gameLogicService.pauseTurnCycle(lobbyId);
        this.server.to(lobbyId).emit(JoinGameEvents.CombatLockStateChanged, {
            lobbyId,
            isLocked: true,
            roomId,
            attackerSocketId: attackerId,
            defenderSocketId: defenderId,
        });
        this.combatRoundGateway.startCombatRoundAwaitingPostures(combatSession);
    }
}
