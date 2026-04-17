import { InitiateCombatPayload, PlayerMoveResult, TransferFlagPayload } from '@app/interfaces/game-logic.interface';
import { SanctuaryUseResult } from '@app/interfaces/sanctuary.interface';
import { BASE_STATS } from '@common/constants/character.constants';
import { Direction, DIRECTION_OFFSETS } from '@common/direction';
import { DiceRollMode, GameMode, SanctuaryMode, TileTexture } from '@common/enums';
import { GameStats } from '@common/interfaces/game-stats';
import { Lobby } from '@common/lobby';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Inject, Injectable } from '@nestjs/common';
import { AbandonResult, AbandonService } from './abandon.service';
import { ActiveGame, TurnCallbacks } from './active-game.interface';
import { CTFService } from './ctf.service';
import { GameActionService } from './game-action.service';
import { GameManagerService } from './game-manager.service';

export { SanctuaryUseResult };

const INITIAL_WINS_COUNT = 0;

@Injectable()
export class GameLogicService {
    private activeGames: Map<string, ActiveGame> = new Map();

    @Inject() private readonly manager: GameManagerService;
    @Inject() private readonly action: GameActionService;
    @Inject() private readonly ctfService: CTFService;
    @Inject() private readonly abandonService: AbandonService;

    setCallbacks(callbacks: TurnCallbacks): void {
        this.manager.setCallbacks(callbacks);
    }

    initializeGame(lobby: Lobby): ActiveGame {
        const spawnPositions = this.manager.extractSpawnPositions(lobby.game);
        const shuffledSpawns = this.manager.shuffle([...spawnPositions]);
        const playerPositions = new Map<string, Vec2>();
        const playerStartPositions = new Map<string, Vec2>();
        const movementPoints = new Map<string, number>();
        const actionPoints = new Map<string, number>();

        for (const player of lobby.players) {
            player.winsCount = INITIAL_WINS_COUNT;
            player.hasAbandonned = false;
            player.character.life = player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
        }

        lobby.players.forEach((player, index) => {
            playerPositions.set(player.socketId, { ...shuffledSpawns[index] });
            playerStartPositions.set(player.socketId, { ...shuffledSpawns[index] });
            movementPoints.set(player.socketId, player.character.speed);
            actionPoints.set(player.socketId, 0);
        });

        this.manager.removeUnusedSpawns(lobby.game, shuffledSpawns, lobby.players.length);
        const turnOrder = this.manager.computeTurnOrder(lobby.players);
        const activeGame: ActiveGame = {
            lobby, turnOrder, currentTurnIndex: 0, playerPositions, playerStartPositions,
            movementPoints, actionPoints, sanctuaryCooldowns: new Map(), playerCombatBonuses: new Map(),
            visitedTilesPerPlayer: new Map(), globalVisitedTiles: new Set(), sanctuariesUsed: new Set(),
            doorsInteracted: new Set(), flagHolders: new Set(), totalTurns: 0, gameStartTime: Date.now(),
            sanctuaryPositions: this.manager.extractSanctuaryPositions(lobby.game),
            doorPositions: this.manager.extractDoorPositions(lobby.game),
        };
        playerPositions.forEach((pos, socketId) => {
            activeGame.visitedTilesPerPlayer.set(socketId, new Set([`${pos.x},${pos.y}`]));
            activeGame.globalVisitedTiles.add(`${pos.x},${pos.y}`);
        });
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
        this.manager.stopTurnCycle(lobbyId);
        this.activeGames.delete(lobbyId);
    }

    startTurnCycle(lobbyId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (game) this.manager.startTurnCycle(game);
    }

    endTurn(lobbyId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (game) this.manager.endTurn(game);
    }

    pauseTurnCycle(lobbyId: string): boolean {
        return this.manager.pauseTurnCycle(lobbyId);
    }

    resumeTurnCycle(lobbyId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        return game ? this.manager.resumeTurnCycle(game) : false;
    }

    incrementTotalTurns(lobbyId: string): void {
        const game = this.activeGames.get(lobbyId);
        if (game) game.totalTurns += 1;
    }

    isPlayerTurn(lobbyId: string, socketId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        return game ? this.manager.isPlayerTurn(game, socketId) : false;
    }

    movePlayer(lobbyId: string, socketId: string, direction: Direction): PlayerMoveResult | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const targetPos = this.action.movePlayer(game, socketId, direction);
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

    teleportPlayer(lobbyId: string, socketId: string, targetPos: Vec2): PlayerMoveResult | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const landingPos = this.action.teleportPlayer(game, socketId, targetPos);
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

    getReachableTilesForTeleport(lobbyId: string): Vec2[] {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.getReachableTilesForTeleport(game) : [];
    }

    getReachableTiles(lobbyId: string, socketId: string): Vec2[] {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.getReachableTiles(game, socketId) : [];
    }

    getMovementPoints(lobbyId: string, socketId: string): number {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.getMovementPoints(game, socketId) : 0;
    }

    getActionPoints(lobbyId: string, socketId: string): number {
        const game = this.activeGames.get(lobbyId);
        return game ? (game.actionPoints.get(socketId) ?? 0) : 0;
    }

    getAdjacentPlayers(lobbyId: string, socketId: string): Player[] {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.getAdjacentPlayers(game, socketId) : [];
    }

    initiateCombat({ lobbyId, attackerId, defenderId, consumeActionPoint = true }: InitiateCombatPayload) {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const diceStrategy = game.isDebugMode ? { attacker: DiceRollMode.Max, defender: DiceRollMode.Min } : undefined;
        const result = this.action.initiateCombat(game, attackerId, defenderId, consumeActionPoint, diceStrategy);
        if (!result) return null;
        const attacker = game.lobby.players.find((p) => p.socketId === attackerId);
        const defender = game.lobby.players.find((p) => p.socketId === defenderId);
        if (result.attacker.killed && attacker?.hasFlag) {
            this.ctfService.setFlagOnNearestValidTile(game, result.attacker.oldPosition, attacker.socketId);
            attacker.hasFlag = false;
            result.wasFlagDropped = true;
            result.droppedFlagPosition = result.attacker.oldPosition;
        }
        if (result.defender.killed && defender?.hasFlag) {
            this.ctfService.setFlagOnNearestValidTile(game, result.defender.oldPosition, defender.socketId);
            defender.hasFlag = false;
            result.wasFlagDropped = true;
            result.droppedFlagPosition = result.defender.oldPosition;
        }
        return result;
    }

    transferFlag({ lobbyId, giverPlayerId, targetPlayerId, payerId }: TransferFlagPayload): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;
        const payerAp = game.actionPoints.get(payerId) ?? 0;
        if (payerAp <= 0) return false;
        if (!this.action.getAdjacentPlayers(game, giverPlayerId).some((p) => p.socketId === targetPlayerId)) return false;
        if (!this.ctfService.wasFlagTransfered(game, giverPlayerId, targetPlayerId)) return false;
        game.actionPoints.set(payerId, payerAp - 1);
        return true;
    }

    checkWinCondition(lobbyId: string, flagOwnerId?: string, flagOwnerPos?: Vec2): Player | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        if (game.lobby.game.gameMode === GameMode.Classic) return this.action.checkCombatWinCondition(game);
        if (game.lobby.game.gameMode === GameMode.Ctf && flagOwnerId && flagOwnerPos) {
            return this.ctfService.checkWinCondition(game, flagOwnerId, flagOwnerPos);
        }
        return null;
    }

    toggleDoor(lobbyId: string, socketId: string, position: Vec2): TileTexture | null {
        const game = this.activeGames.get(lobbyId);
        if (!game) return null;
        const ap = game.actionPoints.get(socketId) ?? 0;
        if (ap <= 0) return null;

        const pos = game.playerPositions.get(socketId);
        if (!pos) return null;

        const isAdjacent = Object.values(DIRECTION_OFFSETS).some(
            (offset) => pos.x + offset.x === position.x && pos.y + offset.y === position.y,
        );
        if (!isAdjacent) return null;

        const tile = game.lobby.game.grid[position.y]?.[position.x];
        if (!tile) return null;
        tile.type = tile.type === TileTexture.DoorClosed ? TileTexture.DoorOpened : TileTexture.DoorClosed;
        game.actionPoints.set(socketId, ap - 1);
        return tile.type;
    }

    useSanctuary(lobbyId: string, socketId: string, pos: Vec2, mode: SanctuaryMode): SanctuaryUseResult | null {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.useSanctuary(game, socketId, pos, mode) : null;
    }

    decrementSanctuaryCooldowns(lobbyId: string, endedSocketId: string): string[] {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.decrementSanctuaryCooldowns(game, endedSocketId) : [];
    }

    getInactiveSanctuaries(lobbyId: string): Vec2[] {
        const game = this.activeGames.get(lobbyId);
        return game ? this.action.computeInactiveSanctuaries(game) : [];
    }

    abandonPlayer(lobbyId: string, socketId: string): Lobby | undefined {
        const game = this.activeGames.get(lobbyId);
        return game ? this.abandonService.abandonPlayer(game, socketId) : undefined;
    }

    executePlayerAbandon(lobbyId: string, socketId: string, deferTurnAdvance = false): AbandonResult {
        const game = this.activeGames.get(lobbyId);
        if (!game) return { isGameOver: false, updatedLobby: undefined, wasCurrentTurn: false };
        return this.abandonService.executePlayerAbandon(
            game,
            socketId,
            {
                isPlayerTurn: (l, s) => this.isPlayerTurn(l, s),
                endTurn: (l) => this.endTurn(l),
                endGame: (l) => this.endGame(l),
                getGameStats: (l) => this.getGameStats(l),
            },
            deferTurnAdvance,
        );
    }

    getActivePlayers(lobbyId: string, team?: 'A' | 'B'): Player[] {
        const game = this.activeGames.get(lobbyId);
        return game ? this.abandonService.getActivePlayers(game, team) : [];
    }

    getGameStats(lobbyId: string): GameStats | null {
        const game = this.activeGames.get(lobbyId);
        return game ? this.manager.buildGameStats(game) : null;
    }

    canToggleAdjacentDoor(lobbyId: string, socketId: string): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;
        const ap = game.actionPoints.get(socketId) ?? 0;
        if (ap <= 0) return false;
        const pos = game.playerPositions.get(socketId);
        if (!pos) return false;
        return Object.values(DIRECTION_OFFSETS).some(({ x, y }) => {
            const tile = game.lobby.game.grid[pos.y + y]?.[pos.x + x];
            return tile?.type === TileTexture.DoorClosed || tile?.type === TileTexture.DoorOpened;
        });
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

    getPlayerStartPositions(lobbyId: string): Record<string, Vec2> {
        const game = this.activeGames.get(lobbyId);
        if (!game) return {};
        const positions: Record<string, Vec2> = {};
        game.playerStartPositions.forEach((pos, socketId) => {
            positions[socketId] = pos;
        });
        return positions;
    }

    getPlayerName(lobbyId: string, socketId: string, fallback = 'Joueur'): string {
        const game = this.activeGames.get(lobbyId);
        return game?.lobby.players.find((p) => p.socketId === socketId)?.character?.name ?? fallback;
    }

    setDebugMode(lobbyId: string, state: boolean): boolean {
        const game = this.activeGames.get(lobbyId);
        if (!game) return false;
        game.isDebugMode = state;
        return true;
    }

    getDebugMode(lobbyId: string): boolean {
        return Boolean(this.activeGames.get(lobbyId)?.isDebugMode);
    }
}
