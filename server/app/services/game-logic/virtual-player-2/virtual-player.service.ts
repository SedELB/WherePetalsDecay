import { Inject, Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { Vec2 } from '@common/vec2';
import { GameMode } from '@common/enums';
import { Player } from '@common/player';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { VirtualPlayerMovementService } from './virtual-player-movement.service';
import { VirtualPlayerProfileService } from './virtual-player-profile.service';
import { VirtualPlayerCtfService } from './virtual-player-ctf.service';
import { VirtualPlayerActionService } from './virtual-player-action.service';
import { TurnContext, StartVirtualPlayerCombat } from '@app/interfaces/virtual-player.interface';
import { VP_CONSTANTS } from '@app/constants/game-logic.constants';

@Injectable()
export class VirtualPlayerService {
    @Inject() private readonly gameLogicService: GameLogicService;
    @Inject() private readonly movementService: VirtualPlayerMovementService;
    @Inject() private readonly profileService: VirtualPlayerProfileService;
    @Inject() private readonly ctfService: VirtualPlayerCtfService;
    @Inject() private readonly action: VirtualPlayerActionService;

    executeTurn(
        server: Server,
        game: ActiveGame,
        virtualPlayer: Player,
        startCombat: StartVirtualPlayerCombat,
        onGameEnded: (lobbyId: string, winnerId: string) => void,
    ): void {
        const delay = VP_CONSTANTS.minActionDelayMs + Math.random() * VP_CONSTANTS.extraActionDelayMs;
        const context: TurnContext = {
            server, game, virtualPlayer, lobbyId: game.lobby.lobbyId, startCombat, onGameEnded,
            continueDecisionCycle: () => this.runDecisionCycle(context),
        };
        setTimeout(() => this.runDecisionCycle(context), delay);
    }

    getPosture(lobbyId: string, socketId: string): Player['character']['bonusPosture'] {
        const game = this.gameLogicService.getActiveGame(lobbyId);
        const player = game?.lobby.players.find((p) => p.socketId === socketId);
        return player?.character.bonusPosture ?? null;
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

    private runDecisionCycle(context: TurnContext): void {
        const { game, virtualPlayer, lobbyId } = context;
        if (!this.gameLogicService.isPlayerTurn(lobbyId, virtualPlayer.socketId)) return;
        if (!game.lobby.players.some((p) => p.socketId === virtualPlayer.socketId)) return;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) {
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        const movementPoints = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0 && movementPoints <= 0) {
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        if (game.lobby.game.gameMode === GameMode.Ctf) {
            this.ctfService.runCtfTurn(context, currentPos, {
                moveTowardThenActWithDoors: this.moveTowardThenActWithDoors.bind(this),
                tryAttackAdjacentEnemy: this.action.combat.tryAttackAdjacentEnemy.bind(this.action.combat),
                runDecisionCycle: this.runDecisionCycle.bind(this),
                endVirtualPlayerTurn: this.endVirtualPlayerTurn.bind(this),
            });
        } else {
            this.runClassicTurn(context, currentPos);
        }
    }

    private runClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const h = {
            moveTowardThenActWithDoors: this.moveTowardThenActWithDoors.bind(this),
            tryAttackAdjacentEnemy: this.action.combat.tryAttackAdjacentEnemy.bind(this.action.combat),
            endVirtualPlayerTurn: this.endVirtualPlayerTurn.bind(this),
        };

        this.profileService.runClassicTurn(context, currentPos, h);
    }

    private moveTowardThenActWithDoors(context: TurnContext, pos: Vec2, target: Vec2, onDone: () => void): void {
        this.movementService.moveTowardThenActWithDoors(context, pos, target, onDone, this.runDecisionCycle.bind(this));
    }

    private continueAfterSanc(context: TurnContext): void {
        if ((context.game.actionPoints.get(context.virtualPlayer.socketId) ?? 0) <= 0) {
            this.endVirtualPlayerTurn(context.lobbyId);
            return;
        }
        setTimeout(() => this.runDecisionCycle(context), VP_CONSTANTS.stepDelayMs);
    }

    private endVirtualPlayerTurn(lid: string): void {
        setTimeout(() => this.gameLogicService.endTurn(lid), VP_CONSTANTS.minActionDelayMs);
    }
}