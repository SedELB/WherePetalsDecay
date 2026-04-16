/* eslint-disable max-lines */
import { Posture } from '@common/character';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { GameMode, TileItem, TileTexture, VirtualPlayerProfile, SanctuaryMode } from '@common/enums';
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

const EVENT_PLAYER_MOVED = 'playerMoved';
const EVENT_DOOR_TOGGLED = 'doorToggled';
const EVENT_ACTION_POINTS = 'actionPoints';

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

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        const movementPoints = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0 && movementPoints <= 0) {
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
        const canUseDoors = actionPoints > 0;

        if (actionPoints <= 0) {
            this.runAggressivePostCombatMovement(context, currentPos);
            return;
        }

        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos, canUseDoors);
        const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.hasCombatBonus(game, virtualPlayer.socketId);

        // Priority 1: attack adjacent enemy first
        if (this.tryAttackAdjacentEnemy(context)) return;

        // Priority 2
        if (!hasCombatBonus && this.tryGoToCombatSanctuaryThisTurn(context, currentPos, costToPosition)) return;

        // Priority 3
        if (isInjured && this.tryMoveAndUseSanctuary(context, currentPos, TileItem.HealingSanctuary)) return;

        // Priority 4
        const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos, canUseDoors);
        if (!hasCombatBonus && this.tryGoToCloserCombatSanctuary(context, currentPos, costToPosition, nearestEnemy)) return;

        if (nearestEnemy) {
            this.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.continueTurnAfterMovement(context);
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

        this.moveTowardThenActWithDoors(context, currentPos, border, () => {
            const used = this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary);
            if (used) {
                this.continueTurnAfterSanctuary(context);
            } else {
                this.continueTurnAfterMovement(context);
            }
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

        this.moveTowardThenActWithDoors(context, currentPos, border, () => {
            const used = this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary);
            if (used) {
                this.continueTurnAfterSanctuary(context);
            } else {
                this.continueTurnAfterMovement(context);
            }
        });
        return true;
    }

    // Post-sanctuary / post-combat aggressive movement:
    //   - If injured, prefer a nearby healing sanctuary
    //   - Otherwise, chase nearest enemy
    private runAggressivePostCombatMovement(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const isInjured = virtualPlayer.character.life < this.getMaxLife(virtualPlayer);
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos);
        const { costToPosition } = dijkstraResult;

        // Priority 1: Healing sanctuary when injured and reachable with current movement budget
        if (isInjured) {
            const healingBorder = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
                sanctuaryType: TileItem.HealingSanctuary,
                reachableThisTurn: true,
                precomputedCostToPosition: costToPosition,
            });
            if (healingBorder && (healingBorder.x !== currentPos.x || healingBorder.y !== currentPos.y)) {
                this.moveTowardThenActWithDoors(context, currentPos, healingBorder, () => this.continueTurnAfterMovement(context));
                return;
            }
        }

        // Priority 2: Move toward nearest enemy.
        // Use door aware enemy detection to still target enemies behind closed doors.
        const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos, true);
        if (nearestEnemy) {
            this.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) {
                    const actionPoints = context.game.actionPoints.get(context.virtualPlayer.socketId) ?? 0;
                    const currentPosAfterMove = context.game.playerPositions.get(context.virtualPlayer.socketId);
                    const isEnemyAdjacent = currentPosAfterMove
                        ? this.scanner.getAdjacentOpponents(context.game, context.virtualPlayer, currentPosAfterMove).length > 0
                        : false;

                    if (actionPoints <= 0 && isEnemyAdjacent) {
                        this.endVirtualPlayerTurn(context.lobbyId);
                        return;
                    }

                    this.continueTurnAfterMovement(context);
                }
            });
            return;
        }

        this.endVirtualPlayerTurn(lobbyId);
    }

    // Defensive : flee all enemies → if a sanctuary is on the flee path, use it and continue
    //   - Prioritize healing sanctuary if injured, otherwise take combat sanctuary if on path
    //   - If cornered, attack
    //   - When the VP has an AP, considers tiles reachable by opening a closed door
    private runDefensiveClassicTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const isInjured = virtualPlayer.character.life < this.getMaxLife(virtualPlayer);
        const hasCombatBonus = this.hasCombatBonus(game, virtualPlayer.socketId);
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // Special defensive door control: when boxed in and an enemy is right behind
        // an adjacent door, avoid opening a closed door; if already open, close it.
        if (this.tryHandleDefensiveBlockedDoor(context, currentPos)) {
            return;
        }

        if (this.isDefensiveFullyCorneredByEnemy(context, currentPos)) {
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        // When the VP has an AP, consider tiles reachable by opening a closed door
        const fleeTarget = this.scanner.chooseFleeTile(game, virtualPlayer, currentPos, actionPoints > 0);

        if (fleeTarget) {
            const retreatTarget = this.chooseBestRetreatTarget(context, currentPos, fleeTarget, isInjured, hasCombatBonus);
            this.moveTowardThenActWithDoors(context, currentPos, retreatTarget, () => {
                // After reaching retreat target, try to use whichever sanctuary we're now adjacent to
                const usedSanctuary =
                    (isInjured && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) ||
                    this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary);
                if (usedSanctuary) {
                    this.continueTurnAfterSanctuary(context);
                } else {
                    this.continueTurnAfterMovement(context);
                }
            });
            return;
        }

        // Defensive VP does not proactively start combat when it cannot flee.
        this.endVirtualPlayerTurn(lobbyId);
    }

    private tryHandleDefensiveBlockedDoor(context: TurnContext, currentPos: Vec2): boolean {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // Defensive priority: if an adjacent opened door has an enemy on the other side,
        // close it if possible, otherwise end turn.
        const openedThreatDoor = this.findAdjacentThreatDoor(context, currentPos, true);
        if (openedThreatDoor) {
            if (actionPoints > 0) this.tryToggleDoorAtPosition(context, openedThreatDoor, TileTexture.DoorOpened);
            this.endVirtualPlayerTurn(lobbyId);
            return true;
        }

        if (this.hasReachableNonDoorTile(game, virtualPlayer, currentPos)) return false;

        const threatDoor = this.findAdjacentThreatDoor(context, currentPos, false);
        if (threatDoor) {
            this.endVirtualPlayerTurn(lobbyId);
            return true;
        }

        return false;
    }

    private hasReachableNonDoorTile(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2): boolean {
        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const reachableWithoutDoors = this.pathfindingService.getReachableTilesWithinBudget(
            game,
            currentPos,
            remainingMovement,
            virtualPlayer.socketId,
            false,
        );
        return reachableWithoutDoors.some((pos) => {
            const tile = game.lobby.game.grid[pos.y]?.[pos.x];
            return tile?.type !== TileTexture.DoorOpened && tile?.type !== TileTexture.DoorClosed;
        });
    }

    private findAdjacentThreatDoor(context: TurnContext, currentPos: Vec2, openedOnly: boolean): Vec2 | null {
        const { game } = context;
        const adjacentDoors: Vec2[] = (Object.values(DIRECTION_OFFSETS) as Vec2[])
            .map((offset) => ({ x: currentPos.x + offset.x, y: currentPos.y + offset.y }))
            .filter((pos) => {
                const tile = game.lobby.game.grid[pos.y]?.[pos.x];
                if (!tile) return false;
                if (openedOnly) return tile.type === TileTexture.DoorOpened;
                return tile.type === TileTexture.DoorClosed || tile.type === TileTexture.DoorOpened;
            });

        for (const doorPos of adjacentDoors) {
            if (this.isOpponentAdjacentToDoor(context, doorPos, currentPos)) return doorPos;
        }

        return null;
    }

    private isDefensiveFullyCorneredByEnemy(context: TurnContext, currentPos: Vec2): boolean {
        const { game, virtualPlayer } = context;
        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const reachableWithoutDoors = this.pathfindingService.getReachableTilesWithinBudget(
            game,
            currentPos,
            remainingMovement,
            virtualPlayer.socketId,
            false,
        );
        if (reachableWithoutDoors.length > 0) return false;

        const adjacentEnemies = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos);
        return adjacentEnemies.length > 0;
    }

    private isOpponentAdjacentToDoor(context: TurnContext, doorPos: Vec2, currentPos: Vec2): boolean {
        const { game, virtualPlayer } = context;

        return game.lobby.players.some((candidate) => {
            if (candidate.socketId === virtualPlayer.socketId || candidate.hasAbandonned) return false;
            if (!this.scanner.isOpponent(game, virtualPlayer, candidate)) return false;

            const pos = game.playerPositions.get(candidate.socketId);
            if (!pos) return false;
            if (pos.x === currentPos.x && pos.y === currentPos.y) return false;

            const distanceToDoor = Math.abs(pos.x - doorPos.x) + Math.abs(pos.y - doorPos.y);
            // Threat if enemy is on the door tile itself or directly adjacent to it.
            return distanceToDoor <= 1;
        });
    }

    // Chooses the best tile to retreat to on the flee path:
    // Prefers a sanctuary border tile along the path (healing if injured, otherwise combat)
    private chooseBestRetreatTarget(context: TurnContext, currentPos: Vec2, fleeTarget: Vec2, isInjured: boolean, hasCombatBonus: boolean): Vec2 {
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
            if (!hasCombatBonus && !combatBorderOnPath && this.scanner.isTileAdjacentToSanctuary(game, pathStep, TileItem.CombatSanctuary)) {
                combatBorderOnPath = pathStep;
            }
        }

        if (isInjured && healingBorderOnPath) return healingBorderOnPath;
        if (combatBorderOnPath) return combatBorderOnPath;
        return fleeTarget;
    }

    private tryUseSanctuaryAtCurrentPosition(context: TurnContext, sanctuaryType: SanctuaryType): boolean {
        const { game, virtualPlayer, lobbyId } = context;

        if (sanctuaryType === TileItem.HealingSanctuary) {
            const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
            if (!isInjured) return false;
        }

        if (sanctuaryType === TileItem.CombatSanctuary && this.hasCombatBonus(game, virtualPlayer.socketId)) {
            return false;
        }

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const sanctuaryPos = this.findAdjacentSanctuaryPosition(game, currentPos, sanctuaryType);
        if (!sanctuaryPos) return false;

        const useResult = this.gameLogicService.useSanctuary(lobbyId, virtualPlayer.socketId, sanctuaryPos, SanctuaryMode.Normal);
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

        const border = this.scanner.findNearestTileAdjacentToSanctuary(game, virtualPlayer, currentPos, {
            sanctuaryType,
            reachableThisTurn: true,
            precomputedCostToPosition: costToPosition,
        });
        if (!border) return false;

        this.moveTowardThenActWithDoors(context, currentPos, border, () => {
            const used = this.tryUseSanctuaryAtCurrentPosition(context, sanctuaryType);
            if (used) {
                this.continueTurnAfterSanctuary(context);
            } else {
                this.continueTurnAfterMovement(context);
            }
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

        // Recheck AP after sanctuary use: if 0 enter post-combat movement phase
        const actionPoints = context.game.actionPoints.get(context.virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0 && remainingMovement > 0) {
            const currentPos = context.game.playerPositions.get(context.virtualPlayer.socketId);
            if (!currentPos) {
                this.endVirtualPlayerTurn(context.lobbyId);
                return;
            }

            setTimeout(() => {
                if (context.virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
                    this.runAggressivePostCombatMovement(context, currentPos);
                } else {
                    this.runDefensiveClassicTurn(context, currentPos);
                }
            }, VP_STEP_DELAY_MS);
            return;
        }

        setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
    }

    private continueTurnAfterMovement(context: TurnContext): void {
        const remainingMovement = context.game.movementPoints.get(context.virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) {
            this.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        if (!this.canStillProgressThisTurn(context)) {
            this.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
    }

    private canStillProgressThisTurn(context: TurnContext): boolean {
        const { game, virtualPlayer } = context;
        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (remainingMovement <= 0) return false;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // If a closed door is adjacent and AP is available, opening it is still meaningful
        if (actionPoints > 0) {
            const hasAdjacentClosedDoor = (Object.values(DIRECTION_OFFSETS) as Vec2[]).some((offset) => {
                const pos = { x: currentPos.x + offset.x, y: currentPos.y + offset.y };
                return game.lobby.game.grid[pos.y]?.[pos.x]?.type === TileTexture.DoorClosed;
            });
            if (hasAdjacentClosedDoor) return true;
        }

        const reachableTiles = this.pathfindingService.getReachableTilesWithinBudget(
            game,
            currentPos,
            remainingMovement,
            virtualPlayer.socketId,
            actionPoints > 0,
        );
        return reachableTiles.length > 0;
    }

    // --------
    // CTF mode

    private runCtfTurn(context: TurnContext, currentPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        // Highest priority: return the flag to start position.
        if (virtualPlayer.hasFlag) {
            const startPos = game.playerStartPositions.get(virtualPlayer.socketId);
            if (!startPos) {
                this.endVirtualPlayerTurn(lobbyId);
                return;
            }
            const needsAp = this.ctfPathNeedsAp(game, virtualPlayer, currentPos, startPos);
            if (this.tryCtfPathSanctuary(context, currentPos, startPos, needsAp)) return;

            this.moveTowardThenActWithDoors(context, currentPos, startPos, () => {
                const pos = game.playerPositions.get(virtualPlayer.socketId);
                if (pos) {
                    const winner = this.gameLogicService.checkWinCondition(lobbyId, virtualPlayer.socketId, pos);
                    if (winner) {
                        context.onGameEnded(lobbyId, winner.socketId);
                        return;
                    }
                }
                // if an enemy blocking the spawn, attack them to clear the path
                if (this.tryAttackAdjacentEnemy(context)) return;
                this.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        // Flag is on the ground
        const flagOnGroundPos = this.scanner.findFlagOnMap(game);
        if (flagOnGroundPos) {
            const needsAp = this.ctfPathNeedsAp(game, virtualPlayer, currentPos, flagOnGroundPos);
            if (this.tryCtfPathSanctuary(context, currentPos, flagOnGroundPos, needsAp)) return;

            this.moveTowardThenActWithDoors(context, currentPos, flagOnGroundPos, () => {
                // VP just races to pick it up
                this.endVirtualPlayerTurn(lobbyId);
            });
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

        // Flag is held by an ally
        const allyCarrier = this.scanner.findAllyFlagCarrier(game, virtualPlayer);
        if (allyCarrier) {
            this.runCtfAllyHasFlag(context, currentPos, allyCarrier);
            return;
        }

        // No flag anywhere relevant – fall back to classic profile behaviour.
        this.runClassicTurn(context, currentPos);
    }

    private runCtfCounterFlagplay(context: TurnContext, currentPos: Vec2, enemyCarrier: Player, carrierPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            // Aggressive: chase the carrier. Need AP only if VP will reach the carrier this turn or there's a door.
            const willReachCarrier = this.isEnemyReachableThisTurn(game, virtualPlayer, currentPos, carrierPos);
            const hasClosedDoor = this.hasClosedDoorOnCtfPath(game, currentPos, carrierPos);
            if (this.tryCtfPathSanctuary(context, currentPos, carrierPos, hasClosedDoor || willReachCarrier)) return;

            this.moveTowardThenActWithDoors(context, currentPos, carrierPos, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.endVirtualPlayerTurn(lobbyId);
            });
        } else {
            // Defensive: block the carrier's start position.
            const carrierStartPos = game.playerStartPositions.get(enemyCarrier.socketId);
            const blockadeTarget = carrierStartPos
                ? this.scanner.findNearestFreePositionAround(game, carrierStartPos, virtualPlayer.socketId)
                : null;
            const target = blockadeTarget ?? carrierPos;
            const needsAp = this.ctfPathNeedsAp(game, virtualPlayer, currentPos, target);
            if (this.tryCtfPathSanctuary(context, currentPos, target, needsAp)) return;

            this.moveTowardThenActWithDoors(context, currentPos, target, () => {
                const hasStartedCombat = this.tryAttackAdjacentEnemy(context);
                if (!hasStartedCombat) this.endVirtualPlayerTurn(lobbyId);
            });
        }
    }

    // --------
    // CTF ally-has-flag behaviour

    private runCtfAllyHasFlag(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { virtualPlayer } = context;

        if (virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive) {
            this.runCtfAggressiveEscort(context, currentPos, allyCarrier);
        } else {
            this.runCtfDefensiveGuard(context, currentPos, allyCarrier);
        }
    }

    // Defensive: guard the ally's spawn
    //   1. If has AP and a reachable enemy exists: attack, then return near spawn.
    //   2. Otherwise : move to an adjacent tile of the ally's spawn and stay
    private runCtfDefensiveGuard(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        const movementPoints = game.movementPoints.get(virtualPlayer.socketId) ?? 0;

        const allySpawn = game.playerStartPositions.get(allyCarrier.socketId);
        if (!allySpawn) {
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        // If has AP and movement, look for a reachable enemy to intercept
        if (actionPoints > 0 && movementPoints > 0) {
            const nearestEnemy = this.scanner.findNearestEnemy(game, virtualPlayer, currentPos, true);
            if (nearestEnemy) {
                const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
                const enemyCost = costToPosition.get(this.pathfindingService.positionKey(nearestEnemy.position)) ?? Infinity;
                if (enemyCost <= movementPoints) {
                    // AP will be used for combat – no sanctuary
                    this.moveTowardThenActWithDoors(context, currentPos, nearestEnemy.position, () => {
                        if (this.tryAttackAdjacentEnemy(context)) return;
                        this.moveBackToSpawnArea(context, allySpawn);
                    });
                    return;
                }
            }
        }

        // No enemy to fight – try sanctuary on the way to the spawn area
        const guardTarget = this.scanner.findNearestFreePositionAround(game, allySpawn, virtualPlayer.socketId);
        if (guardTarget && (guardTarget.x !== currentPos.x || guardTarget.y !== currentPos.y)) {
            const hasClosedDoor = this.hasClosedDoorOnCtfPath(game, currentPos, guardTarget);
            if (this.tryCtfPathSanctuary(context, currentPos, guardTarget, hasClosedDoor)) return;

            this.moveTowardThenActWithDoors(context, currentPos, guardTarget, () => {
                this.endVirtualPlayerTurn(lobbyId);
            });
            return;
        }

        this.endVirtualPlayerTurn(lobbyId);
    }

    // Aggressive: escort the ally
    //   - Move toward the ally's current position
    //   - Attack any adjacent enemy encountered along the way
    //   - Continue approaching after combat
    //   - End turn when 0 AP and 0 MP
    private runCtfAggressiveEscort(context: TurnContext, currentPos: Vec2, allyCarrier: Player): void {
        const { game, virtualPlayer, lobbyId } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        // If adjacent to an enemy and has AP, attack before moving (AP needed for combat)
        if (actionPoints > 0 && this.tryAttackAdjacentEnemy(context)) return;

        const allyPos = game.playerPositions.get(allyCarrier.socketId);
        if (!allyPos) {
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        // No adjacent enemy – try sanctuary on the way to the ally
        const hasClosedDoor = this.hasClosedDoorOnCtfPath(game, currentPos, allyPos);
        const hasAdjacentEnemy = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos).length > 0;
        if (this.tryCtfPathSanctuary(context, currentPos, allyPos, hasClosedDoor || hasAdjacentEnemy)) return;

        this.moveTowardThenActWithDoors(context, currentPos, allyPos, () => {
            if (this.tryAttackAdjacentEnemy(context)) return;
            this.endVirtualPlayerTurn(lobbyId);
        });
    }

    // Helper: move back toward spawn area after an interception, then end turn
    private moveBackToSpawnArea(context: TurnContext, spawnPos: Vec2): void {
        const { game, virtualPlayer, lobbyId } = context;
        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        const remainingMp = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        if (!currentPos || remainingMp <= 0) {
            this.endVirtualPlayerTurn(lobbyId);
            return;
        }

        const returnTarget = this.scanner.findNearestFreePositionAround(game, spawnPos, virtualPlayer.socketId);
        if (returnTarget && (returnTarget.x !== currentPos.x || returnTarget.y !== currentPos.y)) {
            this.moveTowardThenActWithDoors(context, currentPos, returnTarget, () => this.endVirtualPlayerTurn(lobbyId));
        } else {
            this.endVirtualPlayerTurn(lobbyId);
        }
    }

    // --------
    // CTF sanctuary helpers

    // Standard check: AP is needed if there's a closed door on the path or an enemy on the target tile
    private ctfPathNeedsAp(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2, targetPos: Vec2): boolean {
        return this.hasClosedDoorOnCtfPath(game, currentPos, targetPos)
            || this.isEnemyOnTile(game, virtualPlayer, targetPos);
    }

    private hasClosedDoorOnCtfPath(game: ActiveGame, currentPos: Vec2, targetPos: Vec2): boolean {
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        const path = this.pathfindingService.reconstructPath(targetPos, dijkstraResult.predecessorKey);
        if (!path) return false;
        return path.some((step) => game.lobby.game.grid[step.y]?.[step.x]?.type === TileTexture.DoorClosed);
    }

    private isEnemyOnTile(game: ActiveGame, virtualPlayer: Player, pos: Vec2): boolean {
        return game.lobby.players.some((p) => {
            if (p.socketId === virtualPlayer.socketId || p.hasAbandonned) return false;
            if (!this.scanner.isOpponent(game, virtualPlayer, p)) return false;
            const pPos = game.playerPositions.get(p.socketId);
            return pPos !== undefined && pPos.x === pos.x && pPos.y === pos.y;
        });
    }

    // Returns true if the VP can reach a tile adjacent to the enemy this turn
    private isEnemyReachableThisTurn(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2, enemyPos: Vec2): boolean {
        const remainingMp = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        return (Object.values(DIRECTION_OFFSETS) as Vec2[]).some((offset) => {
            const adj = { x: enemyPos.x + offset.x, y: enemyPos.y + offset.y };
            const cost = costToPosition.get(this.pathfindingService.positionKey(adj)) ?? Infinity;
            return cost <= remainingMp;
        });
    }

    // Attempts to use the first sanctuary along the CTF path.
    // Returns true if sanctuary usage was initiated (caller should return).
    private tryCtfPathSanctuary(context: TurnContext, currentPos: Vec2, targetPos: Vec2, needsApForTarget: boolean): boolean {
        if (needsApForTarget) return false;

        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;
        const hasCombatBonus = this.hasCombatBonus(game, virtualPlayer.socketId);

        // Priority 1: use sanctuary at current position
        if (isInjured && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.HealingSanctuary)) {
            setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
            return true;
        }
        if (!hasCombatBonus && this.tryUseSanctuaryAtCurrentPosition(context, TileItem.CombatSanctuary)) {
            setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
            return true;
        }

        // Priority 2: find the first sanctuary border on the reachable path to the target
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        const path = this.pathfindingService.reconstructPath(targetPos, dijkstraResult.predecessorKey);
        if (!path || path.length === 0) return false;

        const sanctuaryOnPath = this.findFirstReachableSanctuaryOnPath(context, path);
        if (!sanctuaryOnPath) return false;

        this.moveTowardThenActWithDoors(context, currentPos, sanctuaryOnPath.position, () => {
            this.tryUseSanctuaryAtCurrentPosition(context, sanctuaryOnPath.type);
            setTimeout(() => this.runDecisionCycle(context), VP_STEP_DELAY_MS);
        });
        return true;
    }

    // Walks along 'path' and returns the first tile (reachable within current MP) that borders a usable sanctuary
    private findFirstReachableSanctuaryOnPath(
        context: TurnContext,
        path: Vec2[],
    ): { position: Vec2; type: TileItem.HealingSanctuary | TileItem.CombatSanctuary } | null {
        const { game, virtualPlayer } = context;
        const remainingMp = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const hasCombatBonus = this.hasCombatBonus(game, virtualPlayer.socketId);
        const isInjured = virtualPlayer.character.life <= this.getMaxLife(virtualPlayer) - HEALING_SANCTUARY_MIN_MISSING_HP;

        let accumulatedCost = 0;
        for (const step of path) {
            const tile = game.lobby.game.grid[step.y]?.[step.x];
            if (!tile) break;

            const moveCost = tile.type === TileTexture.DoorClosed ? 1 : TILE_COSTS[tile.type];
            if (moveCost === Infinity) break;

            accumulatedCost += moveCost;
            if (accumulatedCost > remainingMp) break;

            // Skip door tiles and occupied tiles
            if (tile.type === TileTexture.DoorClosed || tile.type === TileTexture.DoorOpened) continue;
            if (this.pathfindingService.isTileOccupiedByAnotherPlayer(game, step, virtualPlayer.socketId)) continue;

            if (isInjured && this.scanner.isTileAdjacentToSanctuary(game, step, TileItem.HealingSanctuary)) {
                return { position: step, type: TileItem.HealingSanctuary };
            }
            if (!hasCombatBonus && this.scanner.isTileAdjacentToSanctuary(game, step, TileItem.CombatSanctuary)) {
                return { position: step, type: TileItem.CombatSanctuary };
            }
        }

        return null;
    }

    // --------
    // Movement

    // Door aware:
    //   - targeting enemies behind closed doors & depends on AP
    // This lets the VP move as close as possible to a closed door when AP=0
    private moveTowardThenActWithDoors(context: TurnContext, currentPos: Vec2, targetPos: Vec2, onDone: () => void): void {
        const { game, virtualPlayer } = context;
        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;

        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        const fullPath = this.pathfindingService.reconstructPath(targetPos, dijkstraResult.predecessorKey);

        if (!fullPath || fullPath.length === 0) {
            onDone();
            return;
        }

        const remainingMovement = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const canOpenDoorsNow = actionPoints > 0;
        const travelEndpoint = this.pathfindingService.findFurthestReachablePositionOnPath(
            game, fullPath, remainingMovement, virtualPlayer.socketId, canOpenDoorsNow,
        );

        if (!travelEndpoint) {
            this.handleNoTravelEndpoint(context, fullPath, canOpenDoorsNow, remainingMovement, onDone);
            return;
        }

        const travelPath = this.pathfindingService.reconstructPath(travelEndpoint, dijkstraResult.predecessorKey) ?? [];
        this.stepAlongPath(context, travelPath, 0, onDone);
    }

    private handleNoTravelEndpoint(
        context: TurnContext,
        fullPath: Vec2[],
        canOpenDoorsNow: boolean,
        remainingMovement: number,
        onDone: () => void,
    ): void {
        const firstStep = fullPath[0];
        const firstTile = firstStep ? context.game.lobby.game.grid[firstStep.y]?.[firstStep.x] : null;

        // If the VP is adjacent to a closed door and has AP but no movement left,
        // open the door before ending turn.
        if (canOpenDoorsNow && remainingMovement <= 0 && firstTile?.type === TileTexture.DoorClosed) {
            this.tryToggleDoorAtPosition(context, firstStep, TileTexture.DoorClosed);
            onDone();
            return;
        }

        // VP is already in front of a closed door with no AP to open it:
        // no further progress is possible this turn, so end turn now.
        if (!canOpenDoorsNow && firstTile?.type === TileTexture.DoorClosed) {
            this.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        onDone();
    }

    // Recursively executes one movement step per tick, broadcasting each move to clients.
    private stepAlongPath(context: TurnContext, path: Vec2[], stepIndex: number, onDone: () => void): void {
        const { server, game, virtualPlayer, lobbyId } = context;

        // Abort if the turn was skipped (debug mode)
        if (!this.gameLogicService.isPlayerTurn(lobbyId, virtualPlayer.socketId)) return;

        if (stepIndex >= path.length) {
            onDone();
            return;
        }

        const targetStep = path[stepIndex];

        // If the next tile is a closed door and the VP has an AP, open it before moving.
        const tileAtTarget = game.lobby.game.grid[targetStep.y]?.[targetStep.x];
        if (tileAtTarget?.type === TileTexture.DoorClosed) {
            const opened = this.tryToggleDoorAtPosition(context, targetStep, TileTexture.DoorClosed);
            if (!opened) {
                onDone();
                return;
            }
            // Door opened: continue to the next step (we land on the opened door)
            setTimeout(() => this.stepAlongPath(context, path, stepIndex, onDone), VP_STEP_DELAY_MS);
            return;
        }

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

    // Toggles a door (open or close) adjacent to the VP's current position if it matches expectedType
    // Returns true on success, false if the VP has no AP or the door can't be toggled
    private tryToggleDoorAtPosition(context: TurnContext, doorPos: Vec2, expectedType: TileTexture): boolean {
        const { server, game, virtualPlayer, lobbyId } = context;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const tile = game.lobby.game.grid[doorPos.y]?.[doorPos.x];
        if (tile?.type !== expectedType) return false;

        const result = this.gameLogicService.toggleDoor(lobbyId, virtualPlayer.socketId, doorPos);
        if (!result) return false;

        server.to(lobbyId).emit(EVENT_DOOR_TOGGLED, {
            position: doorPos,
            newType: game.lobby.game.grid[doorPos.y][doorPos.x].type,
        });

        const updatedAp = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        server.to(lobbyId).emit(EVENT_ACTION_POINTS, { socketId: virtualPlayer.socketId, actionPoints: updatedAp });

        return true;
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

        // Pre-select the VP's posture before combat so CombatService uses the right bonus.
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
        return game.playerCombatBonuses.has(socketId);
    }

    // -------------------------------------------
    // Statistics (MovementService.trackTileVisit)

    private trackTileVisitStats(game: ActiveGame, socketId: string, pos: Vec2): void {
        const tile = game.lobby.game.grid[pos.y]?.[pos.x];
        if (!tile) return;

        const key = this.pathfindingService.positionKey(pos);
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