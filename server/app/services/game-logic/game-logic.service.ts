import { BASE_STATS } from '@common/constants/character.constants';
import { Direction } from '@common/direction';
import { PlayerType, GameMode } from '@common/enums';
import { GameStats } from '@common/interfaces/game-stats';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ActiveGame, TurnCallbacks } from './active-game.interface';
import { CombatService } from './combat.service';
import { CTFService } from './ctf.service';
import { GameSetupService } from './game-setup.service';
import { MovementService } from './movement.service';
import { TurnService } from './turn.service';

const INITIAL_WINS_COUNT = 0;

@Injectable()
export class GameLogicService {
    private activeGames: Map<string, ActiveGame>;

    constructor(
        private readonly turnService: TurnService,
        private readonly movementService: MovementService,
        private readonly combatService: CombatService,
        private readonly ctfService: CTFService,
        private readonly gameSetupService: GameSetupService,
    ) {
        this.activeGames = new Map<string, ActiveGame>();
    }

    // Setup

    setCallbacks(callbacks: TurnCallbacks): void {
        this.turnService.setCallbacks(callbacks);
    }

    initializeGame(lobby: Lobby): ActiveGame {
        const spawnPositions = this.gameSetupService.extractSpawnPositions(lobby.game);
        const shuffledSpawns = this.gameSetupService.shuffle([...spawnPositions]);

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

        this.gameSetupService.removeUnusedSpawns(lobby.game, shuffledSpawns, activePlayers.length);
        const turnOrder = this.gameSetupService.computeTurnOrder(activePlayers);

        const activeGame: ActiveGame = {
            lobby,
            turnOrder,
            currentTurnIndex: 0,
            playerPositions,
            playerStartPositions,
            movementPoints,
            actionPoints,
            visitedTilesPerPlayer: new Map(),
            globalVisitedTiles: new Set(),
            sanctuariesUsed: new Set(),
            doorsInteracted: new Set(),
            flagHolders: new Set(),
            totalTurns: 0,
            gameStartTime: Date.now(),
        };

        for (const [socketId, pos] of playerPositions) {
            activeGame.visitedTilesPerPlayer.set(socketId, new Set([`${pos.x},${pos.y}`]));
            activeGame.globalVisitedTiles.add(`${pos.x},${pos.y}`);
        }

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
        if (!game) return;
        game.totalTurns++;
        this.turnService.endTurn(game);
    }

    incrementTotalTurns(lobbyId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (game) game.totalTurns++;
    }

    isPlayerTurn(lobbyId: string, socketId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;
        return this.turnService.isPlayerTurn(game, socketId);
    }

    // Movement methods

    movePlayer(lobbyId: string, socketId: string, direction: Direction): { position: Vec2; flagJustTaken: boolean } | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const targetPos = this.movementService.movePlayer(game, socketId, direction);
        if (!targetPos) return null;

        let flagJustTaken = false;
        if (this.ctfService.isThereFlag(game, targetPos)) {
            this.ctfService.removeFlagFromTile(game, targetPos);
            const player = game.lobby.players.find((p) => p.socketId === socketId);
            if (player) player.hasFlag = true;
            flagJustTaken = true;
        }

        return { position: targetPos, flagJustTaken };
    }

    teleportPlayer(lobbyId: string, socketId: string, targetPos: Vec2): { position: Vec2; flagJustTaken: boolean } | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const landingPos = this.movementService.teleportPlayer(game, socketId, targetPos);
        if (!landingPos) return null;

        let flagJustTaken = false;
        if (this.ctfService.isThereFlag(game, landingPos)) {
            this.ctfService.removeFlagFromTile(game, landingPos);
            const player = game.lobby.players.find((p) => p.socketId === socketId);
            if (player) player.hasFlag = true;
            flagJustTaken = true;
        }

        return { position: landingPos, flagJustTaken };
    }

    getReachableTilesForTeleport(lobbyId: string, socketId: string): Vec2[] {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.movementService.getReachableTilesForTeleport(game, socketId);
    }

    getReachableTiles(lobbyId: string, socketId: string): Vec2[] {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.movementService.getReachableTiles(game, socketId);
    }

    getMovementPoints(lobbyId: string, socketId: string): number {
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

    getAdjacentPlayers(lobbyId: string, socketId: string): Player[] {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.combatService.getAdjacentPlayers(game, socketId);
    }

    initiateCombat(lobbyId: string, attackerId: string, defenderId: string, consumeActionPoint = true) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;

        const diceStrategy = game.isDebugMode
            ? { attacker: 'max' as const, defender: 'min' as const }
            : undefined;

        const combatResult = this.combatService.initiateCombat(game, attackerId, defenderId, consumeActionPoint, diceStrategy);
        if (!combatResult) return null;

        const attacker = game.lobby.players.find((player) => player.socketId === attackerId);
        const defender = game.lobby.players.find((player) => player.socketId === defenderId);

        if (combatResult.attacker.killed && attacker?.hasFlag) {
            this.ctfService.setFlagOnNearestValidTile(game, combatResult.attacker.oldPosition, attacker.socketId);
            attacker.hasFlag = false;
            combatResult.wasFlagDropped = true;
            combatResult.droppedFlagPosition = combatResult.attacker.oldPosition;
        }

        if (combatResult.defender.killed && defender?.hasFlag) {
            this.ctfService.setFlagOnNearestValidTile(game, combatResult.defender.oldPosition, defender.socketId);
            defender.hasFlag = false;
            combatResult.wasFlagDropped = true;
            combatResult.droppedFlagPosition = combatResult.defender.oldPosition;
        }

        return combatResult;
    }

    transferFlag(lobbyId: string, giverPlayerId: string, targetPlayerId: string, payerId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;

        const payerActionPoints = game.actionPoints.get(payerId) ?? 0;
        if (payerActionPoints <= 0) return false;

        const adjacentPlayers = this.getAdjacentPlayers(lobbyId, giverPlayerId);
        if (!adjacentPlayers.some((player) => player.socketId === targetPlayerId)) return false;

        const wasFlagTransfered = this.ctfService.wasFlagTransfered(game, giverPlayerId, targetPlayerId);
        if (!wasFlagTransfered) return false;

        game.actionPoints.set(payerId, payerActionPoints - 1);
        return true;
    }

    checkWinCondition(lobbyId: string, flagOwnerId?: string, flagOwnerPos?: Vec2): Player | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;

        if (game.lobby.game.gameMode === GameMode.Classic) return this.combatService.checkWinCondition(game);
        if (game.lobby.game.gameMode === GameMode.Ctf && flagOwnerId && flagOwnerPos) {
            return this.ctfService.checkWinCondition(game, flagOwnerId, flagOwnerPos);
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

    executePlayerAbandon(lobbyId: string, socket: Socket, server: Server): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;

        const wasCurrentTurn = this.isPlayerTurn(lobbyId, socket.id);
        const updatedLobby = this.abandonPlayer(lobbyId, socket.id);

        if (updatedLobby) {
            const payload = { socketId: socket.id, updatedLobby };
            server.to(lobbyId).emit(JoinGameEvents.PlayerAbandoned, payload);
        }

        socket.leave(lobbyId);

        const activePlayers = this.getActivePlayers(lobbyId);
        const activeRealPlayers = activePlayers.filter((p) => p.playerType === PlayerType.Reel);

        if (game.lobby.game.gameMode === GameMode.Ctf) {
            const teamA = this.getActivePlayers(lobbyId, 'A');
            const teamB = this.getActivePlayers(lobbyId, 'B');
            if (teamA.length === 0) {
                server.to(lobbyId).emit(JoinGameEvents.GameOver, { abandonTeam: 'A', 
                    players: [...game.lobby.players], gameStats: this.getGameStats(lobbyId) });
                this.endGame(lobbyId);
                return true;
            }
            if (teamB.length === 0) {
                server.to(lobbyId).emit(JoinGameEvents.GameOver, { abandonTeam: 'B', 
                    players: [...game.lobby.players], gameStats: this.getGameStats(lobbyId) });
                this.endGame(lobbyId);
                return true;
            }
        }

        if (activePlayers.length <= 1 || activeRealPlayers.length === 0) {
            const winnerId = activePlayers.length === 1 ? activePlayers[0].socketId : null;
            const gameStats = this.getGameStats(lobbyId);
            const allPlayers = [...game.lobby.players];
            server.to(lobbyId).emit(JoinGameEvents.GameOver, { winnerSocketId: winnerId, isForfeit: true, players: allPlayers, gameStats });
            this.endGame(lobbyId);
            server.in(lobbyId).socketsLeave(lobbyId);
            return true;
        }

        if (wasCurrentTurn) {
            this.endTurn(lobbyId);
            return false;
        }

        return false;
    }

    getActivePlayers(lobbyId: string, team?: 'A' | 'B'): Player[] {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];

        if (team === 'A') return game.lobby.teamA.filter((player) => !player.hasAbandonned);
        if (team === 'B') return game.lobby.teamB.filter((player) => !player.hasAbandonned);
        return game.lobby.players.filter((player) => !player.hasAbandonned);
    }

    getGameStats(lobbyId: string): GameStats | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        return this.gameSetupService.buildGameStats(game);
    }

    // Alt

    shufflePlayers(players: Player[]): Player[] {
        return this.gameSetupService.shuffle([...players]);
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
}
