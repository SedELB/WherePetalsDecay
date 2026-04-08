import { BASE_STATS } from '@common/constants/character.constants';
import { Direction } from '@common/direction';
import { GameMode, TileItem } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ActiveGame, TurnCallbacks } from './active-game.interface';
import { CombatService } from './combat.service';
import { CTFService } from './ctf.service';
import { MovementService } from './movement.service';
import { TurnService } from './turn.service';

const RANDOM_THRESHOLD = 0.5;
const INITIAL_WINS_COUNT = 0;

@Injectable()
export class GameLogicService {
    constructor(
        private readonly turnService: TurnService,
        private readonly movementService: MovementService,
        private readonly combatService: CombatService,
        private readonly ctfService: CTFService,
    ) {
        this.activeGames = new Map<string, ActiveGame>();
    }

    private activeGames: Map<string, ActiveGame>;

    // Setup

    setCallbacks(callbacks: TurnCallbacks): void {
        this.turnService.setCallbacks(callbacks);
    }

    initializeGame(lobby: Lobby): ActiveGame {
        const spawnPositions = this.extractSpawnPositions(lobby.game);
        const shuffledSpawns = this.shuffle([...spawnPositions]);

        const playerPositions = new Map<string, Vec2>();
        const playerStartPositions = new Map<string, Vec2>();
        const movementPoints = new Map<string, number>();
        const actionPoints = new Map<string, number>();

        for (const player of lobby.players) {
            player.winsCount = INITIAL_WINS_COUNT;
            player.hasAbandonned = false;
            player.character.life = player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
        }

        const activePlayers = lobby.players;
        activePlayers.forEach((player, index) => {
            playerPositions.set(player.socketId, { ...shuffledSpawns[index] });
            playerStartPositions.set(player.socketId, { ...shuffledSpawns[index] });
            movementPoints.set(player.socketId, player.character.speed);
            actionPoints.set(player.socketId, 0);
        });

        this.removeUnusedSpawns(lobby.game, shuffledSpawns, activePlayers.length);

        const turnOrder = this.computeTurnOrder(activePlayers);

        const activeGame: ActiveGame = {
            lobby,
            turnOrder,
            currentTurnIndex: 0,
            playerPositions,
            playerStartPositions,
            movementPoints,
            actionPoints,
        };

        this.activeGames.set(lobby.lobbyId, activeGame);
        return activeGame;
    }

    getActiveGame(lobbyId: string): ActiveGame | undefined {
        return this.activeGames.get(lobbyId);
    }

    findActiveGameBySocketId(socketId: string): ActiveGame | undefined {
        return Array.from(this.activeGames.values()).find((game) =>
            game.lobby.players.some((player) => player.socketId === socketId && !player.hasAbandonned),
        );
    }

    endGame(lobbyId: string): void {
        this.turnService.stopTurnCycle(lobbyId);
        this.activeGames.delete(lobbyId);
    }

    // Turn methods

    startTurnCycle(lobbyId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (game) this.turnService.startTurnCycle(game);
    }

    endTurn(lobbyId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (game) this.turnService.endTurn(game);
    }

    isPlayerTurn(lobbyId: string, socketId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;
        return this.turnService.isPlayerTurn(game, socketId);
    }

    // Movement methods

    movePlayer(lobbyId: string, socketId: string, direction: Direction) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const targetPos = this.movementService.movePlayer(game, socketId, direction);
        if (!targetPos) return null;

        let flagJustTaken = false;
        const isThereFlag = this.ctfService.isThereFlag(game, targetPos);
        if (isThereFlag) {
            this.ctfService.removeFlagFromTile(game, targetPos);
            const player = game.lobby.players.find(p => p.socketId === socketId);
            player.hasFlag = true;
            flagJustTaken = true;
        }

        return { position: targetPos, flagJustTaken };
    }

    teleportPlayer(lobbyId: string, socketId: string, targetPos: Vec2) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const landingPos = this.movementService.teleportPlayer(game, socketId, targetPos);
        if (!landingPos) return null;

        let flagJustTaken = false;
        const isThereFlag = this.ctfService.isThereFlag(game, landingPos);
        if (isThereFlag) {
            this.ctfService.removeFlagFromTile(game, landingPos);
            const player = game.lobby.players.find(p => p.socketId === socketId);
            player.hasFlag = true;
            flagJustTaken = true;
        }

        return { position: landingPos, flagJustTaken };
    }

    getReachableTilesForTeleport(lobbyId: string, socketId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.movementService.getReachableTilesForTeleport(game, socketId);
    }

    getReachableTiles(lobbyId: string, socketId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.movementService.getReachableTiles(game, socketId);
    }

    getMovementPoints(lobbyId: string, socketId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return 0;
        return this.movementService.getMovementPoints(game, socketId);
    }

    getActionPoints(lobbyId: string, socketId: string): number {
        const game = this.activeGames.get(lobbyId);
        if (!game) return 0;
        return game.actionPoints.get(socketId) ?? 0;
    }

    // Combat methods

    getAdjacentPlayers(lobbyId: string, socketId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.combatService.getAdjacentPlayers(game, socketId);
    }

    initiateCombat(lobbyId: string, attackerId: string, defenderId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;

        const combatResult = this.combatService.initiateCombat(game, attackerId, defenderId);
        const loser = combatResult.loser;

        if (loser.hasFlag) {
            this.ctfService.setFlagOnNearestValidTile(game, combatResult.loserOldPosition, loser.socketId);
            loser.hasFlag = false;
            combatResult.wasFlagDropped = true;
        }

        return combatResult;
    }

    transferFlag(lobbyId: string, giverPlayerId: string, targetPlayerId: string, payerId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;

        const payerActionPoints = game.actionPoints.get(payerId) ?? 0;
        if (payerActionPoints <= 0) return null;

        const adjacentPlayers = this.getAdjacentPlayers(lobbyId, giverPlayerId);
        if (!adjacentPlayers.some((player) => player.socketId === targetPlayerId)) return null;

        const wasFlagTransfered = this.ctfService.wasFlagTransfered(game, giverPlayerId, targetPlayerId);
        if (wasFlagTransfered) {
            game.actionPoints.set(payerId, payerActionPoints - 1);
            return true;
        } else {
            return false;
        }
    }

    checkWinCondition(lobbyId: string, flagOwnerId?: string, flagOwnerPos?: Vec2) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;

        if (game.lobby.game.gameMode === GameMode.Classic) return this.combatService.checkWinCondition(game);
        if (game.lobby.game.gameMode === GameMode.Ctf) {
            if (flagOwnerId && flagOwnerPos) {
                return this.ctfService.checkWinCondition(game, flagOwnerId, flagOwnerPos);
            }
        }
        return null;
    }

    // Abandon

    abandonPlayer(lobbyId: string, socketId: string): Lobby | undefined {
        const game = this.activeGames.get(lobbyId);
        if (!game) return;

        const player = game.lobby.players.find((p) => p.socketId === socketId);
        const playerPos = game.playerPositions.get(socketId);

        if (player) player.hasAbandonned = true;

        if (player.hasFlag) {
            player.hasFlag = false;
            this.ctfService.setFlagOnNearestValidTile(game, playerPos, socketId);
        }

        const spawnPos = game.playerStartPositions.get(socketId);
        if (spawnPos) {
            game.lobby.game.grid[spawnPos.y][spawnPos.x].item = null;
        }

        game.playerPositions.delete(socketId);
        return game.lobby;
    }

    executePlayerAbandon(lobbyId: string, socket: Socket, server: Server): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return;

        const wasCurrentTurn = this.isPlayerTurn(lobbyId, socket.id);
        const updatedLobby = this.abandonPlayer(lobbyId, socket.id);

        if (updatedLobby) {
            const payload = { socketId: socket.id, updatedLobby };
            server.to(lobbyId).emit(JoinGameEvents.PlayerAbandoned, payload);
        }

        socket.leave(lobbyId);

        const activePlayers = this.getActivePlayers(lobbyId);

        if (game.lobby.game.gameMode === GameMode.Ctf) {
            const teamA = this.getActivePlayers(lobbyId, 'A');
            const teamB = this.getActivePlayers(lobbyId, 'B');
            if (teamA.length === 0) {
                server.to(lobbyId).emit(JoinGameEvents.GameOver, { abandonTeam: 'A' });
                this.endGame(lobbyId);
                return true;

            } else if (teamB.length === 0) {
                server.to(lobbyId).emit(JoinGameEvents.GameOver, { abandonTeam: 'B' });
                this.endGame(lobbyId);
                return true;
            }
        }

        if (activePlayers.length <= 1) {
            const winnerId = activePlayers.length === 1 ? activePlayers[0].socketId : null;
            server.to(lobbyId).emit(JoinGameEvents.GameOver, { winnerSocketId: winnerId, isForfeit: true });

            this.endGame(lobbyId);
            server.in(lobbyId).socketsLeave(lobbyId);

            return true;
        } else if (wasCurrentTurn) {
            this.endTurn(lobbyId);
            return false;
        }

        return false;
    }

    getActivePlayers(lobbyId: string, team?: 'A' | 'B'): Player[] {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];

        if (team === 'A') {
            return game.lobby.teamA.filter(player => !player.hasAbandonned);
        } else if (team === 'B') {
            return game.lobby.teamB.filter(player => !player.hasAbandonned);
        } else {
            return game.lobby.players.filter((player) => !player.hasAbandonned);
        }
    }

    // Alt

    shufflePlayers(players: Player[]): Player[] {
        return this.shuffle([...players]);
    }

    getPlayerPositions(lobbyId: string): Record<string, Vec2> {
        const game = this.activeGames.get(lobbyId);
        if (!game) return {};

        const positions: Record<string, Vec2> = {};
        game.playerPositions.forEach((pos, socketId) => {
            positions[socketId] = pos;
        });
        return positions;
    }

    private removeUnusedSpawns(game: Game, shuffledSpawns: Vec2[], playerCount: number): void {
        const usedSpawns = new Set(shuffledSpawns.slice(0, playerCount).map((s) => `${s.x},${s.y}`));
        for (let row = 0; row < game.grid.length; row++) {
            for (let col = 0; col < game.grid[row].length; col++) {
                if (game.grid[row][col].item === TileItem.Spawn && !usedSpawns.has(`${col},${row}`)) {
                    game.grid[row][col].item = null;
                }
            }
        }
    }

    private extractSpawnPositions(game: Game): Vec2[] {
        const spawns: Vec2[] = [];
        for (let row = 0; row < game.grid.length; row++) {
            for (let col = 0; col < game.grid[row].length; col++) {
                if (game.grid[row][col].item === TileItem.Spawn) {
                    spawns.push({ x: col, y: row });
                }
            }
        }
        return spawns;
    }

    private computeTurnOrder(players: Player[]): string[] {
        const sorted = [...players].sort((a, b) => {
            const speedDiff = b.character.speed - a.character.speed;
            if (speedDiff !== 0) return speedDiff;
            return Math.random() - RANDOM_THRESHOLD;
        });
        return sorted.map((p) => p.socketId);
    }

    private shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
