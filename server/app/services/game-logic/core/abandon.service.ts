import { Injectable } from '@nestjs/common';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { GameMode, PlayerType } from '@common/enums';
import { ActiveGame } from './active-game.interface';
import { CTFService } from './ctf.service';
import { GameStats } from '@common/interfaces/game-stats';

export interface AbandonResult {
    isGameOver: boolean;
    updatedLobby: Lobby | undefined;
    gameOverPayload?: {
        winnerSocketId?: string | null;
        isForfeit?: boolean;
        abandonTeam?: string;
        players: Player[];
        gameStats: GameStats | null;
    };
    wasCurrentTurn: boolean;
}

@Injectable()
export class AbandonService {
    constructor(private readonly ctfService: CTFService) {}

    abandonPlayer(game: ActiveGame, socketId: string): Lobby | undefined {
        const player = game.lobby.players.find((p) => p.socketId === socketId);
        const playerPos = game.playerPositions.get(socketId);

        if (player) player.hasAbandonned = true;

        if (player?.hasFlag) {
            player.hasFlag = false;
            if (playerPos) this.ctfService.setFlagOnNearestValidTile(game, playerPos, socketId);
        }

        const spawnPos = game.playerStartPositions.get(socketId);
        if (spawnPos) {
            game.lobby.game.grid[spawnPos.y][spawnPos.x].item = null;
        }

        game.playerPositions.delete(socketId);
        return game.lobby;
    }

    executePlayerAbandon(
        game: ActiveGame,
        socketId: string,
        handlers: {
            isPlayerTurn: (lobbyId: string, socketId: string) => boolean;
            endTurn: (lobbyId: string) => void;
            endGame: (lobbyId: string) => void;
            getGameStats: (lobbyId: string) => GameStats | null;
        },
        deferTurnAdvance = false,
    ): AbandonResult {
        const { isPlayerTurn, endTurn, endGame, getGameStats } = handlers;
        const lobbyId = game.lobby.lobbyId;
        const wasCurrentTurn = isPlayerTurn(lobbyId, socketId);
        const updatedLobby = this.abandonPlayer(game, socketId);

        const activePlayers = this.getActivePlayers(game);
        const activeRealPlayers = activePlayers.filter((p) => p.playerType === PlayerType.Reel);

        if (game.lobby.game.gameMode === GameMode.Ctf) {
            const teamA = this.getActivePlayers(game, 'A');
            const teamB = this.getActivePlayers(game, 'B');
            if (teamA.length === 0 || teamB.length === 0) {
                const abandonTeam = teamA.length === 0 ? 'A' : 'B';
                endGame(lobbyId);
                return {
                    isGameOver: true, updatedLobby, wasCurrentTurn,
                    gameOverPayload: { abandonTeam, players: [...game.lobby.players], gameStats: getGameStats(lobbyId) },
                };
            }
        }

        if (activePlayers.length <= 1 || activeRealPlayers.length === 0) {
            endGame(lobbyId);
            return {
                isGameOver: true, updatedLobby, wasCurrentTurn,
                gameOverPayload: { winnerSocketId: null, isForfeit: true, players: [...game.lobby.players], gameStats: getGameStats(lobbyId) },
            };
        }

        if (wasCurrentTurn && !deferTurnAdvance) {
            endTurn(lobbyId);
        }

        return { isGameOver: false, updatedLobby, wasCurrentTurn };
    }

    getActivePlayers(game: ActiveGame, team?: 'A' | 'B'): Player[] {
        if (team === 'A') return game.lobby.teamA.filter((player) => !player.hasAbandonned);
        if (team === 'B') return game.lobby.teamB.filter((player) => !player.hasAbandonned);
        return game.lobby.players.filter((player) => !player.hasAbandonned);
    }
}
