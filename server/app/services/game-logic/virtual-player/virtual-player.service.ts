import { GameMode } from '@common/enums';
import { Player } from '@common/player';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { ActiveGame } from '../core/active-game.interface';
import { GameLogicService } from '../core/game-logic.service';
import { StartVirtualPlayerCombat, TurnContext, VPActionService } from './vp-action.service';
import { VPClassicStrategyService } from './vp-classic-strategy.service';
import { VPCtfStrategyService } from './vp-ctf-strategy.service';

@Injectable()
export class VirtualPlayerService {
    constructor(
        private readonly actionService: VPActionService,
        private readonly classicStrategy: VPClassicStrategyService,
        private readonly ctfStrategy: VPCtfStrategyService,
        private readonly gameLogicService: GameLogicService,
    ) {}

    getPosture(lobbyId: string, socketId: string): Player['character']['bonusPosture'] {
        const game = this.gameLogicService.getActiveGame(lobbyId);
        const player = game?.lobby.players.find((p) => p.socketId === socketId);
        if (!player) return null;

        if (player.virtualProfile) {
            const selectedPosture = this.actionService.postureForProfile(player.virtualProfile);
            player.character.bonusPosture = { ...selectedPosture };
            return player.character.bonusPosture;
        }

        return player.character.bonusPosture ?? null;
    }

    triggerTurn(
        server: Server,
        lobbyId: string,
        socketId: string,
        startCombat: StartVirtualPlayerCombat,
        onGameEnded: (lobbyId: string, winnerId: string) => void,
    ): void {
        const game = this.gameLogicService.getActiveGame(lobbyId);
        const player = game?.lobby.players.find((p) => p.socketId === socketId);
        if (!game || !player) return;
        this.executeTurn(server, game, player, startCombat, onGameEnded);
    }

    // Called by the gateway the moment a VP's turn starts
    executeTurn(
        server: Server,
        game: ActiveGame,
        virtualPlayer: Player,
        startCombat: StartVirtualPlayerCombat,
        onGameEnded: (lobbyId: string, winnerId: string) => void,
    ): void {
        const delay = this.actionService.getRandomTurnStartDelay();
        const context: TurnContext = {
            server, game, virtualPlayer, lobbyId: game.lobby.lobbyId, startCombat, onGameEnded,
            continueDecisionCycle: () => this.runDecisionCycle(context),
        };
        setTimeout(() => this.runDecisionCycle(context), delay);
    }

    // Decision cycle
    private runDecisionCycle(context: TurnContext): void {
        const { game, virtualPlayer, lobbyId } = context;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, virtualPlayer.socketId)) return;

        const isStillActive = game.lobby.players.some((p) => p.socketId === virtualPlayer.socketId);
        if (!isStillActive) return;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        const movementPoints = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0 && movementPoints <= 0) {
            this.actionService.endVirtualPlayerTurn(lobbyId);
            return;
        }

        if (game.lobby.game.gameMode === GameMode.Ctf) {
            this.ctfStrategy.runCtfTurn(context, currentPos);
        } else {
            this.classicStrategy.runClassicTurn(context, currentPos);
        }
    }
}