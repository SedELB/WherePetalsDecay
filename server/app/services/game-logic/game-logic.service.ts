import { BASE_STATS } from '@common/character';
import { Direction } from '@common/direction';
import { TileItem } from '@common/enums';
import { Game } from '@common/game';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame, TurnCallbacks } from './active-game.interface';
import { CombatService } from './combat.service';
import { MovementService } from './movement.service';
import { TurnService } from './turn.service';

const RANDOM_THRESHOLD = 0.5;

@Injectable()
export class GameLogicService {
    constructor(
        private readonly turnService: TurnService,
        private readonly movementService: MovementService,
        private readonly combatService: CombatService,
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
        const hasCombatted = new Map<string, boolean>();

        for (const player of lobby.players) {
            player.winsCount = 0;
            player.hasAbandonned = false;
            player.character.life = player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
        }

        const activePlayers = lobby.players;
        activePlayers.forEach((player, index) => {
            playerPositions.set(player.socketId, { ...shuffledSpawns[index] });
            playerStartPositions.set(player.socketId, { ...shuffledSpawns[index] });
            movementPoints.set(player.socketId, player.character.speed);
            hasCombatted.set(player.socketId, false);
        });

        const turnOrder = this.computeTurnOrder(activePlayers);

        const activeGame: ActiveGame = {
            lobby,
            turnOrder,
            currentTurnIndex: 0,
            playerPositions,
            playerStartPositions,
            movementPoints,
            hasCombatted,
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
        return this.movementService.movePlayer(game, socketId, direction);
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

    // Combat methods

    getAdjacentPlayers(lobbyId: string, socketId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return this.combatService.getAdjacentPlayers(game, socketId);
    }

    initiateCombat(lobbyId: string, attackerId: string, defenderId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        return this.combatService.initiateCombat(game, attackerId, defenderId);
    }

    checkWinCondition(lobbyId: string) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        return this.combatService.checkWinCondition(game);
    }

    // Abandon

    abandonPlayer(lobbyId: string, socketId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (!game) return;

        const player = game.lobby.players.find((p) => p.socketId === socketId);
        if (player) player.hasAbandonned = true;

        game.playerPositions.delete(socketId);
    }

    getActivePlayers(lobbyId: string): Player[] {
        const game = this.activeGames.get(lobbyId);
        if (!game) return [];
        return game.lobby.players.filter((player) => !player.hasAbandonned);
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
