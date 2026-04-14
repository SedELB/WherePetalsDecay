/* eslint-disable max-lines */
import { Posture } from '@common/character';
import { BASE_STATS } from '@common/constants/character.constants';
import { GameMode, TileItem, VirtualPlayerProfile } from '@common/enums';
import { Player } from '@common/player';
import { SanctuaryType } from '@common/tile';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { ActiveGame } from './active-game.interface';
import { GameLogicService } from './game-logic.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';

const VP_MIN_ACTION_DELAY_MS = 1000;
const VP_EXTRA_ACTION_DELAY_MS = 2000;
const VP_STEP_DELAY_MS = 300;
const HEALING_SANCTUARY_MIN_MISSING_HP = 2;

const AGGRESSIVE_POSTURE: Posture = { type: 'atk', bonus: 2 };
const DEFENSIVE_POSTURE: Posture = { type: 'def', bonus: 2 };

const EVENT_PLAYER_MOVED = 'playerMoved'; // TODO : move to common/events.ts

// Function used by VirtualPlayerService to ask the gateway to start VP combat
type StartVirtualPlayerCombat = (lobbyId: string, attackerId: string, defenderId: string) => void;

// Bundles the objects shared across every helper called during one VP turn
interface TurnContext {
    server: Server;
    game: ActiveGame;
    virtualPlayer: Player;
    lobbyId: string;
    startCombat: StartVirtualPlayerCombat;
    onGameEnded: (lobbyId: string, winnerId: string) => void;
}

@Injectable()
export class VirtualPlayerService {
    constructor(
        private readonly pathfindingService: VirtualPlayerPathfindingService,
        private readonly gameLogicService: GameLogicService,
        private readonly scanner: VirtualPlayerScannerService,
    ) {}

    // Called by the gateway the moment a VP's turn starts
    executeTurn(
        server: Server,
        game: ActiveGame,
        virtualPlayer: Player,
        startCombat: StartVirtualPlayerCombat,
        onGameEnded: (lobbyId: string, winnerId: string) => void,
    ): void {
        const delay = VP_MIN_ACTION_DELAY_MS + Math.random() * VP_EXTRA_ACTION_DELAY_MS;
        const context: TurnContext = { server, game, virtualPlayer, lobbyId: game.lobby.lobbyId, startCombat, onGameEnded };
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
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        if (game.lobby.game.gameMode === GameMode.Ctf) {
            this.runCtfTurn(context, currentPos);
        } else {
            this.runClassicTurn(context, currentPos);
        }
    }

    // ------------
    // Classic mode

    private runClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer } = context;
        const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.hasCombatBonus(game, virtualPlayer.socketId);

        // Always attempt to use a sanctuary at current position first
        // If injured: healing sanctuary takes priority over combat sanctuary
        if (isInjured && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) {
            this.continueTurnAfterSanctuary(context);
            return;
        }
        // Only try combat sanctuary if VP doesn't already have the bonus
        if (!hasCombatBonus && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary)) {
            this.continueTurnAfterSanctuary(context);
            return;
        }
        // Fallback: healing sanctuary if injured and combat wasn't applicable
        if (isInjured && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) {
            this.continueTurnAfterSanctuary(context);
            return;
        }

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runAggressiveClassicTurn(context, currentPos);
        } else {
            this.runDefensiveClassicTurn(context, currentPos);
        }
    }

    // Aggressive :
    //   1. Combat sanctuary reachable this turn (only if no combat bonus yet) -> go use it
    //   2. Healing sanctuary reachable if injured -> go use it
    //   3. Enemy adjacent -> attack
    //   4. Neither reachable -> compare distances, go toward the closest
    private runAggressiveClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) {
            this.runAggressivePostCombatMovement(context, currentPos);
            return;
        }

        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos);
        const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.hasCombatBonus(game, virtualPlayer.socketId);

        // Priority 1
        if (!hasCombatBonus && this.tryGoToCombatSanctuaryThisTurn(context, currentPos, costToPosition)) return;

        // Priority 2
        if (isInjured && this.tryMoveAndUseSanctuary(context, currentPos, TileItem.HealingSanctuary)) return;

        // Priority 3
        if (this.tryAttackAdjacentEnemy(context)) return;

        // Priority 4
        const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos);
        if (!hasCombatBonus && this.tryGoToCloserCombatSanctuary(context, currentPos, costToPosition, nearestEnemy)) return;

        if (nearestEnemy) {
            this.moveTowardThenAct(context, currentPos, nearestEnemy.position, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        this.endVirtualPlayerTurn(lobbyId);
    }

    // Moves toward a combat sanctuary border reachable this turn, returns true if one was found
    private tryGoToCombatSanctuaryThisTurn(context: TurnContext, currentPos: Vec2, costToPosition: Map<string, number>): boolean {
        const { game, virtualPlayer } = context;
        const border = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
            sanctuaryType: TileItem.CombatSanctuary,
            reachableThisTurn: true,
            precomputedCostToPosition: costToPosition,
        });
        if (!border) return false;

        this.moveTowardThenAct(context, currentPos, border, () => {
            this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary);
            this.continueTurnAfterSanctuary(context);
        });
        return true;
    }

    // Compares distance to nearest combat sanctuary vs nearest enemy. Goes toward sanctuary if closer.
    private tryGoToCloserCombatSanctuary(
        context: TurnContext,
        currentPos: Vec2,
        costToPosition: Map<string, number>,
        nearestEnemy: { player: Player; position: Vec2 } | null,
    ): boolean {
        const { game, virtualPlayer } = context;
        const border = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
            sanctuaryType: TileItem.CombatSanctuary,
            precomputedCostToPosition: costToPosition,
        });
        if (!border) return false;

        const enemyCost = nearestEnemy
            ? (costToPosition.get(this.pathfindingService.positionKey(nearestEnemy.position)) ?? Infinity)
            : Infinity;
        const sanctuaryCost = costToPosition.get(this.pathfindingService.positionKey(border)) ?? Infinity;
        if (sanctuaryCost > enemyCost) return false;

        this.moveTowardThenAct(context, currentPos, border, () => {
            this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary);
            this.continueTurnAfterSanctuary(context);
        });
        return true;
    }

    // After combat (no AP left): healing sanctuary > combat sanctuary > nearest enemy
    private runAggressivePostCombatMovement(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos);
        const { costToPosition } = dijkstraResult;

        // Healing sanctuary takes priority when injured
        if (isInjured) {
            const healingBorder = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
                sanctuaryType: TileItem.HealingSanctuary,
                precomputedCostToPosition: costToPosition,
            });
            if (healingBorder) {
                this.moveTowardThenAct(context, currentPos, healingBorder, () => this.endVirtualPlayerTurn(lobbyId));
                return;
            }
        }

        const combatBorder = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
            sanctuaryType: TileItem.CombatSanctuary,
            precomputedCostToPosition: costToPosition,
        });
        const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos);

        const combatCost = combatBorder
            ? (costToPosition.get(this.pathfindingService.positionKey(combatBorder)) ?? Infinity)
            : Infinity;
        const enemyCost = nearestEnemy
            ? (costToPosition.get(this.pathfindingService.positionKey(nearestEnemy.position)) ?? Infinity)
            : Infinity;

        if (combatBorder && combatCost <= enemyCost) {
            this.moveTowardThenAct(context, currentPos, combatBorder, () => this.endVirtualPlayerTurn(lobbyId));
            return;
        }

        if (nearestEnemy) {
            this.moveTowardThenAct(context, currentPos, nearestEnemy.position, () => this.endVirtualPlayerTurn(lobbyId));
            return;
        }

        this.endVirtualPlayerTurn(lobbyId);
    }

    // Defensive : flee all enemies → if a sanctuary is on the flee path, use it and continue
    //   - Prioritize healing sanctuary if injured, otherwise take combat sanctuary if on path
    //   - If cornered, attack
    private runDefensiveClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const isInjured = virtualPlayer.character.life < this.getMaxLife(virtualPlayer);

        const fleeTarget = this.scanner.chooseFleeTile(game, virtualPlayer, currentPos);
        if (fleeTarget) {
            const retreatTarget = this.chooseBestRetreatTarget(context, currentPos, fleeTarget, isInjured);
            this.moveTowardThenAct(context, currentPos, retreatTarget, () => {
                // After reaching retreat target, try to use whichever sanctuary we're now adjacent to
                const usedSanctuary =
                    (isInjured && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) ||
                    this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary);
                if (usedSanctuary) {
                    this.continueTurnAfterSanctuary(context);
                } else {
                    this.endVirtualPlayerTurn(lobbyId);
                }
            });
            return;
        }

        if (this.tryAttackAdjacentEnemy(context)) {
            return;
        }

        this.endVirtualPlayerTurn(lobbyId);
    }

    // Chooses the best tile to retreat to on the flee path:
    // Prefers a sanctuary border tile along the path (healing if injured, otherwise combat)
    private chooseBestRetreatTarget(context: TurnContext, currentPos: Vec2, fleeTarget: Vec2, isInjured: boolean): Vec2 {
        const { game } = context;
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos);
        const fleePath = this.pathfindingService.reconstructPath(fleeTarget, dijkstraResult.predecessorKey);
        if (!fleePath) return fleeTarget;

        // Scan path for sanctuary border tiles — healing takes priority over combat
        let healingBorderOnPath: Vec2 | null = null;
        let combatBorderOnPath: Vec2 | null = null;

        for (const pathStep of fleePath) {
            if (!healingBorderOnPath && this.scanner.isTileAdjacentToSanctuary(game, pathStep, TileItem.HealingSanctuary)) {
                healingBorderOnPath = pathStep;
            }
            if (!combatBorderOnPath && this.scanner.isTileAdjacentToSanctuary(game, pathStep, TileItem.CombatSanctuary)) {
                combatBorderOnPath = pathStep;
            }
        }

        if (isInjured && healingBorderOnPath) return healingBorderOnPath;
        if (combatBorderOnPath) return combatBorderOnPath;
        if (isInjured && healingBorderOnPath) return healingBorderOnPath;
        return fleeTarget;
    }

    private tryUseSanctuaryAtCurrentPosition(context: TurnContext, sanctuaryType: SanctuaryType): boolean {
        const { game, virtualPlayer, lobbyId } = context;

        if (sanctuaryType === TileItem.HealingSanctuary) {
            const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
            if (!isInjured) return false;
        }

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const sanctuaryPos = this.findAdjacentSanctuaryPosition(game, currentPos, sanctuaryType);
        if (!sanctuaryPos) return false;

        const useResult = this.gameLogicService.useSanctuary(lobbyId, virtualPlayer.socketId, sanctuaryPos, 'normal');
        return Boolean(useResult);
    }

    private tryMoveAndUseSanctuary(context: TurnContext, currentPos: Vec2, sanctuaryType: SanctuaryType): boolean {
        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        if (sanctuaryType === TileItem.HealingSanctuary) {
            const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
            if (!isInjured) return false;
        }

        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos);

        // TODO: check later if we can delete this
        // if (!this.scanner.findNearestReachableSanctuary(game, virtualPlayer, currentPos, [sanctuaryType], costToPosition)) return false;

        const border = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
            sanctuaryType,
            reachableThisTurn: true,
            precomputedCostToPosition: costToPosition,
        });
        if (!border) return false;

        this.moveTowardThenAct(context, currentPos, border, () => {
            this.tryUseSanctuaryAtCurrentPosition(context, sanctuaryType);
            this.continueTurnAfterSanctuary(context);
        });
        return true;
    }

    private findAdjacentSanctuaryPosition(game: ActiveGame, currentPos: Vec2, sanctuaryType: SanctuaryType): Vec2 | null {
        const candidatesPos: Vec2[] = [
            { x: currentPos.x, y: currentPos.y - 1 },
            { x: currentPos.x - 1, y: currentPos.y },
            { x: currentPos.x, y: currentPos.y + 1 },
            { x: currentPos.x + 1, y: currentPos.y },
        ];

        for (const pos of candidatesPos) {
            const tile = game.lobby.game.grid[pos.y]?.[pos.x];
            if (tile?.item === sanctuaryType) return pos;
        }

        return null;
    }

    private continueTurnAfterSanctuary(context: TurnContext): void {
        const remainingMovement = context.game.movementPoints.get(context.virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) {
            this.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
    }

    // --------
    // CTF mode

    // TODO : if we are in ctf and the VP is defensive, maybe we can use the 10s delay and make the choice in a random time

    private runCtfTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        // Highest priority: return the flag to start position.
        if (virtualPlayer.hasFlag) {
            const startPos = game.playerStartPositions.get(virtualPlayer.socketId);
            if (!startPos) {
                this.endVirtualPlayerTurn(lobbyId);
                return;
            }
            this.moveTowardThenAct(context, currentPos, startPos, () => {
                const pos = game.playerPositions.get(virtualPlayer.socketId);
                if (pos) {
                    const winner = this.gameLogicService.checkWinCondition(lobbyId, virtualPlayer.socketId, pos);
                    if (winner) context.onGameEnded(lobbyId, winner.socketId);
                }
                this.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        // Flag is on the ground
        const flagOnGroundPos = this.scanner.findFlagOnMap(game);
        if (flagOnGroundPos) {
            this.moveTowardThenAct(context, currentPos, flagOnGroundPos, () => this.endVirtualPlayerTurn(lobbyId));
            return;
        }

        // Flag is held by an enemy
        const enemyCarrier = this.scanner.findEnemyFlagCarrier(game, virtualPlayer);
        if (enemyCarrier) {
            const carrierPos = game.playerPositions.get(enemyCarrier.socketId);
            if (carrierPos) {
                this.runCtfCounterFlagplay(context, currentPos, enemyCarrier, carrierPos);
                return;
            }
        }

        // No flag anywhere relevant – fall back to classic profile behaviour.
        this.runClassicTurn(context, currentPos);
    }

    private runCtfCounterFlagplay(context: TurnContext, currentPos: Vec2, enemyCarrier: Player, carrierPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            // Chase and attack the carrier.
            this.moveTowardThenAct(context, currentPos, carrierPos, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.endVirtualPlayerTurn(lobbyId);
            });
        } else {
            // Block the carrier's start position.
            const carrierStartPos = game.playerStartPositions.get(enemyCarrier.socketId);
            const blockadeTarget = carrierStartPos
                ? this.scanner.findNearestFreePositionAround(game, carrierStartPos, virtualPlayer.socketId)
                : null;

            this.moveTowardThenAct(context, currentPos, blockadeTarget ?? carrierPos, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.endVirtualPlayerTurn(lobbyId);
            });
        }
    }

    // --------
    // Movement

    // Computes Dijkstra to 'targetPos' and steps as far as the VP's
    // movement points allows, then calls 'onDone'
    private moveTowardThenAct(context: TurnContext, currentPos: Vec2, targetPos: Vec2, onDone: () => void): void {
        const { game, virtualPlayer } = context;
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos);
        const fullPath = this.pathfindingService.reconstructPath(targetPos, dijkstraResult.predecessorKey);

        if (!fullPath || fullPath.length === 0) {
            onDone();
            return;
        }

        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const furthestStep = this.pathfindingService.findFurthestReachablePositionOnPath(
            game, fullPath, remainingMovement, virtualPlayer.socketId,
        );

        if (!furthestStep) {
            onDone();
            return;
        }

        const travelPath = this.pathfindingService.reconstructPath(furthestStep, dijkstraResult.predecessorKey) ?? [];
        this.stepAlongPath(context, travelPath, 0, onDone);
    }

    // Recursively executes one movement step per tick, broadcasting each move to clients 
    private stepAlongPath(context: TurnContext, path: Vec2[], stepIndex: number, onDone: () => void): void {
        const { server, game, virtualPlayer, lobbyId } = context;

        // Abort if the turn was skipped (debug mode)
        if (!this.gameLogicService.isPlayerTurn(lobbyId, virtualPlayer.socketId)) return;

        if (stepIndex >= path.length) {
            onDone();
            return;
        }

        const targetStep = path[stepIndex];

        if (!this.applyMovementStep(game, virtualPlayer, targetStep)) {
            onDone(); // Tile became blocked.
            return;
        }

        const movementPoints = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const flagJustTaken = this.tryPickUpFlag(game, virtualPlayer, targetStep);

        server.to(lobbyId).emit(EVENT_PLAYER_MOVED, {
            socketId: virtualPlayer.socketId,
            position: targetStep,
            movementPoints,
            flagTaken: flagJustTaken,
        });

        if (flagJustTaken && movementPoints > 0) {
            setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
            return;
        }

        setTimeout(
            () => this.stepAlongPath(context, path, stepIndex + 1, onDone),
            VP_STEP_DELAY_MS,
        );
    }

    // Validates a move and sync game state if valid. Returns 'true' on success.
    private applyMovementStep(game: ActiveGame, virtualPlayer: Player, targetPos: Vec2): boolean {
        const tile = game.lobby.game.grid[targetPos.y]?.[targetPos.x];
        if (!tile) return false;

        const moveCost = TILE_COSTS[tile.type];
        if (moveCost === Infinity) return false;

        if (this.pathfindingService.isSanctuaryTile(game, targetPos)) return false;

        const currentMvtPts = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (moveCost > currentMvtPts) return false;

        if (this.pathfindingService.isTileOccupiedByAnotherPlayer(game, targetPos, virtualPlayer.socketId)) return false;

        game.movementPoints.set(virtualPlayer.socketId, currentMvtPts - moveCost);
        game.playerPositions.set(virtualPlayer.socketId, { ...targetPos });
        this.trackTileVisitStats(game, virtualPlayer.socketId, targetPos);
        return true;
    }

    // Picks up the CTF flag if the VP stepped onto it. Returns 'true' if just taken
    private tryPickUpFlag(game: ActiveGame, virtualPlayer: Player, pos: Vec2): boolean {
        if (game.lobby.game.gameMode !== GameMode.Ctf) return false;
        if (game.lobby.game.grid[pos.y]?.[pos.x]?.item !== TileItem.Flag) return false;

        game.lobby.game.grid[pos.y][pos.x].item = null;
        virtualPlayer.hasFlag = true;
        game.flagHolders.add(virtualPlayer.socketId);
        return true;
    }

    // ------
    // Combat

    // Picks the best adjacent opponent and delegates combat to the gateway.
    // Returns 'true' if combat was initiated.
    private tryAttackAdjacentEnemy(context: TurnContext): boolean {
        const { game, virtualPlayer, lobbyId, startCombat } = context;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const adjacentEnemies = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos);
        if (adjacentEnemies.length === 0) return false;

        const target = this.selectBestAttackTarget(adjacentEnemies, game, virtualPlayer);

        // Apply the VP's posture before combat so CombatService uses the right bonus.
        // TODO : here we preselect the posture****
        virtualPlayer.character.bonusPosture = this.postureForProfile(virtualPlayer.virtualProfile);

        startCombat(lobbyId, virtualPlayer.socketId, target.socketId);
        return true;
    }

    // In CTF aggressive mode, prefers attacking the enemy carrying the flag
    // Otherwise targets the enemy with the least remaining HP
    private selectBestAttackTarget(candidates: Player[], game: ActiveGame, virtualPlayer: Player): Player {
        const preferFlagCarrier =
            game.lobby.game.gameMode === GameMode.Ctf && virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive;

        if (preferFlagCarrier) {
            const flagCarrier = candidates.find((p) => p.hasFlag);
            if (flagCarrier) return flagCarrier;
        }

        return candidates.reduce((weakest, current) => (current.character.life < weakest.character.life ? current : weakest));
    }

    private postureForProfile(profile: VirtualPlayerProfile): Posture {
        return profile === VirtualPlayerProfile.Aggressive ? AGGRESSIVE_POSTURE : DEFENSIVE_POSTURE;
    }

    private getMaxLife(player: Player): number {
        return player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    }

    // Returns true if the VP already has an active combat sanctuary bonus
    // (prevents seeking or using a second combat sanctuary for a double effect)
    private hasCombatBonus(game: ActiveGame, socketId: string): boolean {
        return game.playerCombatBonusTurns.has(socketId);
    }

    // -------------------------------------------
    // Statistics (MovementService.trackTileVisit)

    private trackTileVisitStats(game: ActiveGame, socketId: string, pos: Vec2): void {
        const tile = game.lobby.game.grid[pos.y]?.[pos.x];
        if (!tile) return;

        const key = this.pathfindingService.positionKey(pos);
        // TODO : does is work with open door ?
        const isPassableTerrain = tile.type === 'floor' || tile.type === 'water' || tile.type === 'ice' || tile.type === 'doorOpened';

        if (isPassableTerrain) {
            if (!game.visitedTilesPerPlayer.has(socketId)) game.visitedTilesPerPlayer.set(socketId, new Set());
            const visited = game.visitedTilesPerPlayer.get(socketId);
            if (visited) visited.add(key);
            game.globalVisitedTiles.add(key);
        }

        if (tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary) game.sanctuariesUsed.add(key);
        if (tile.type === 'doorOpened') game.doorsInteracted.add(key);
        if (tile.item === TileItem.Flag) game.flagHolders.add(socketId);
    }

    // --------
    // Turn end

    private endVirtualPlayerTurn(lobbyId: string): void {
        setTimeout(() => this.gameLogicService.endTurn(lobbyId), VP_MIN_ACTION_DELAY_MS);
    }
}