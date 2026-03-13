import { GameStatus, TileItem } from '@common/enums';
import { Game } from '@common/game';
import { GamePlayer } from '@common/game-player';
import { GameSession } from '@common/game-session';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';

const RANDOM_THRESHOLD = 0.5;

@Injectable()
export class GameSessionService {
    constructor() {
        this.sessions = new Map<string, GameSession>();
    }

    private sessions: Map<string, GameSession>;

    createSession(lobby: Lobby): GameSession {
        const spawnPositions = this.extractSpawnPositions(lobby.game);
        const shuffledSpawns = this.shuffle([...spawnPositions]);
        const players = this.initializePlayers(lobby.players, shuffledSpawns);
        const turnOrder = this.computeTurnOrder(players);

        const session: GameSession = {
            gameId: lobby.gameId,
            game: lobby.game,
            players,
            currentTurnIndex: 0,
            turnOrder,
            status: GameStatus.Playing,
            winner: null,
        };

        this.sessions.set(lobby.gameId, session);
        return session;
    }

    getSession(gameId: string): GameSession | undefined {
        return this.sessions.get(gameId);
    }

    findSessionBySocketId(socketId: string): GameSession | undefined {
        return Array.from(this.sessions.values()).find((session) =>
            session.players.some((player) => player.socketId === socketId && player.isActive),
        );
    }

    removePlayer(gameId: string, socketId: string): GamePlayer | undefined {
        const session = this.sessions.get(gameId);
        if (!session) return undefined;

        const player = session.players.find((p) => p.socketId === socketId);
        if (player) {
            player.isActive = false;
        }
        return player;
    }

    getActivePlayers(gameId: string): GamePlayer[] {
        const session = this.sessions.get(gameId);
        if (!session) return [];
        return session.players.filter((player) => player.isActive);
    }

    getCurrentPlayer(session: GameSession): GamePlayer | undefined {
        const socketId = session.turnOrder[session.currentTurnIndex];
        return session.players.find((player) => player.socketId === socketId);
    }

    endSession(gameId: string): void {
        this.sessions.delete(gameId);
    }

    extractSpawnPositions(game: Game): Vec2[] {
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

    initializePlayers(players: Player[], spawnPositions: Vec2[]): GamePlayer[] {
        return players.map((player, index) => ({
            ...player,
            position: { ...spawnPositions[index] },
            startPosition: { ...spawnPositions[index] },
            movementPoints: player.character.speed,
            victories: 0,
            isActive: true,
            hasCombatted: false,
        }));
    }

    computeTurnOrder(players: GamePlayer[]): string[] {
        const sorted = [...players].sort((a, b) => {
            const speedDiff = b.character.speed - a.character.speed;
            if (speedDiff !== 0) return speedDiff;
            return Math.random() - RANDOM_THRESHOLD;
        });
        return sorted.map((player) => player.socketId);
    }

    // Allows to shuffle any type without redefining a function for that specific type
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
