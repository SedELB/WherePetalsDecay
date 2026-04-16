import { Injectable } from '@nestjs/common';
import { Game } from '@common/game';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { ActiveGame, TurnCallbacks } from './active-game.interface';
import { TurnService } from './turn.service';
import { GameSetupService } from './game-setup.service';

@Injectable()
export class GameManagerService {
    constructor(
        private readonly turnService: TurnService,
        private readonly gameSetupService: GameSetupService,
    ) {}

    setCallbacks(callbacks: TurnCallbacks): void {
        this.turnService.setCallbacks(callbacks);
    }

    startTurnCycle(game: ActiveGame): void {
        this.turnService.startTurnCycle(game);
    }

    stopTurnCycle(lobbyId: string): void {
        this.turnService.stopTurnCycle(lobbyId);
    }

    endTurn(game: ActiveGame): void {
        this.turnService.endTurn(game);
    }

    pauseTurnCycle(lobbyId: string): boolean {
        return this.turnService.pauseTurnCycle(lobbyId);
    }

    resumeTurnCycle(game: ActiveGame): boolean {
        return this.turnService.resumeTurnCycle(game);
    }

    isPlayerTurn(game: ActiveGame, socketId: string): boolean {
        return this.turnService.isPlayerTurn(game, socketId);
    }

    extractSpawnPositions(game: Game) {
        return this.gameSetupService.extractSpawnPositions(game);
    }

    shuffle<T>(array: T[]): T[] {
        return this.gameSetupService.shuffle(array);
    }

    removeUnusedSpawns(game: Game, shuffledSpawns: Vec2[], activePlayersCount: number) {
        this.gameSetupService.removeUnusedSpawns(game, shuffledSpawns, activePlayersCount);
    }

    computeTurnOrder(activePlayers: Player[]) {
        return this.gameSetupService.computeTurnOrder(activePlayers);
    }

    extractSanctuaryPositions(game: Game) {
        return this.gameSetupService.extractSanctuaryPositions(game);
    }

    extractDoorPositions(game: Game) {
        return this.gameSetupService.extractDoorPositions(game);
    }

    buildGameStats(game: ActiveGame) {
        return this.gameSetupService.buildGameStats(game);
    }
}
