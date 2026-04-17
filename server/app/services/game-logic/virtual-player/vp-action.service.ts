import { JournalService } from '@app/services/journal/journal.service';
import { Posture } from '@common/character';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { GameMode, SanctuaryMode, TileItem, TileTexture, VirtualPlayerProfile } from '@common/enums';
import { Player } from '@common/player';
import { SanctuaryType } from '@common/tile';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Inject, Injectable } from '@nestjs/common';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { TurnContext, StartVirtualPlayerCombat, OnGameEnded } from '@app/interfaces/virtual-player.interface';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { VirtualPlayerScannerService } from './virtual-player-scanner.service';
import {
    VP_ACTION_DELAY_MIN_MS, VP_ACTION_DELAY_MAX_MS,
    VP_TURN_START_DELAY_MIN_MS, VP_TURN_START_DELAY_MAX_MS,
    VP_STEP_DELAY_MIN_MS, VP_STEP_DELAY_MAX_MS,
    HEALING_SANCTUARY_MIN_MISSING_HP,
    AGGRESSIVE_POSTURE, DEFENSIVE_POSTURE,
    EVENT_PLAYER_MOVED, EVENT_DOOR_TOGGLED, EVENT_ACTION_POINTS,
    EVENT_SANCTUARY_USED, EVENT_PLAYER_STATS_UPDATE,
} from './vp.constants';

export { TurnContext, StartVirtualPlayerCombat, OnGameEnded, HEALING_SANCTUARY_MIN_MISSING_HP };

@Injectable()
export class VPActionService {
    @Inject() private readonly pathfindingService: VirtualPlayerPathfindingService;
    @Inject() private readonly gameLogicService: GameLogicService;
    @Inject() private readonly scanner: VirtualPlayerScannerService;
    @Inject() private readonly journalService: JournalService;

    moveTowardThenActWithDoors(context: TurnContext, currentPos: Vec2, targetPos: Vec2, onDone: () => void): void {
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

        if (canOpenDoorsNow && remainingMovement <= 0 && firstTile?.type === TileTexture.DoorClosed) {
            this.tryToggleDoorAtPosition(context, firstStep, TileTexture.DoorClosed);
            onDone();
            return;
        }

        if (!canOpenDoorsNow && firstTile?.type === TileTexture.DoorClosed) {
            this.endVirtualPlayerTurn(context.lobbyId);
            return;
        }

        onDone();
    }

    private stepAlongPath(context: TurnContext, path: Vec2[], stepIndex: number, onDone: () => void): void {
        const { server, game, virtualPlayer, lobbyId } = context;

        if (!this.gameLogicService.isPlayerTurn(lobbyId, virtualPlayer.socketId)) return;

        if (stepIndex >= path.length) {
            onDone();
            return;
        }

        const targetStep = path[stepIndex];

        const tileAtTarget = game.lobby.game.grid[targetStep.y]?.[targetStep.x];
        if (tileAtTarget?.type === TileTexture.DoorClosed) {
            const opened = this.tryToggleDoorAtPosition(context, targetStep, TileTexture.DoorClosed);
            if (!opened) {
                onDone();
                return;
            }
            setTimeout(() => this.stepAlongPath(context, path, stepIndex, onDone), this.getRandomActionDelay());
            return;
        }

        if (!this.applyMovementStep(game, virtualPlayer, targetStep)) {
            onDone();
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
            setTimeout(() => context.continueDecisionCycle(), this.getRandomActionDelay());
            return;
        }

        setTimeout(
            () => this.stepAlongPath(context, path, stepIndex + 1, onDone),
            this.getRandomStepDelay(),
        );
    }

    tryToggleDoorAtPosition(context: TurnContext, doorPos: Vec2, expectedType: TileTexture): boolean {
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

    private tryPickUpFlag(game: ActiveGame, virtualPlayer: Player, pos: Vec2): boolean {
        if (game.lobby.game.gameMode !== GameMode.Ctf) return false;
        if (game.lobby.game.grid[pos.y]?.[pos.x]?.item !== TileItem.Flag) return false;

        game.lobby.game.grid[pos.y][pos.x].item = null;
        virtualPlayer.hasFlag = true;
        game.flagHolders.add(virtualPlayer.socketId);
        return true;
    }

    tryAttackAdjacentEnemy(context: TurnContext): boolean {
        const { game, virtualPlayer, lobbyId, startCombat } = context;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const currentPos = game.playerPositions.get(virtualPlayer.socketId);
        if (!currentPos) return false;

        const adjacentEnemies = this.scanner.getAdjacentOpponents(game, virtualPlayer, currentPos);
        if (adjacentEnemies.length === 0) return false;

        const target = this.selectBestAttackTarget(adjacentEnemies, game, virtualPlayer);

        virtualPlayer.character.bonusPosture = this.postureForProfile(virtualPlayer.virtualProfile);

        startCombat(lobbyId, virtualPlayer.socketId, target.socketId);
        return true;
    }

    private selectBestAttackTarget(candidates: Player[], game: ActiveGame, virtualPlayer: Player): Player {
        const preferFlagCarrier =
            game.lobby.game.gameMode === GameMode.Ctf && virtualPlayer.virtualProfile === VirtualPlayerProfile.Aggressive;

        if (preferFlagCarrier) {
            const flagCarrier = candidates.find((p) => p.hasFlag);
            if (flagCarrier) return flagCarrier;
        }

        return candidates.reduce((weakest, current) => (current.character.life < weakest.character.life ? current : weakest));
    }

    tryUseSanctuaryAtCurrentPosition(context: TurnContext, sanctuaryType: SanctuaryType): boolean {
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
        if (!useResult) return false;

        context.server.to(lobbyId).emit(EVENT_SANCTUARY_USED, {
            socketId: virtualPlayer.socketId,
            position: sanctuaryPos,
            sanctuaryType: useResult.sanctuaryType,
            mode: useResult.mode,
            healAmount: useResult.healAmount,
            combatBonusApplied: useResult.combatBonusApplied,
            playerNewLife: useResult.playerNewLife,
            playerName: useResult.playerName,
            inactiveSanctuaries: useResult.inactiveSanctuaries,
        });

        if (useResult.combatBonusApplied) {
            context.server.to(lobbyId).emit(EVENT_PLAYER_STATS_UPDATE, {
                socketId: virtualPlayer.socketId,
                attack: virtualPlayer.character.attack,
                defense: virtualPlayer.character.defense,
                life: virtualPlayer.character.life,
            });
        }

        this.journalService.addSanctuaryUsedEntry(
            lobbyId,
            useResult.playerName,
            {
                sanctuaryType: useResult.sanctuaryType,
                mode: useResult.mode,
                healAmount: useResult.healAmount,
                combatBonusApplied: useResult.combatBonusApplied,
            },
        );

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

    findFirstReachableSanctuaryOnPath(
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

    postureForProfile(profile: VirtualPlayerProfile): Posture {
        return profile === VirtualPlayerProfile.Aggressive ? AGGRESSIVE_POSTURE : DEFENSIVE_POSTURE;
    }

    getMaxLife(player: Player): number {
        return player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    }

    hasCombatBonus(game: ActiveGame, socketId: string): boolean {
        return game.playerCombatBonuses.has(socketId);
    }

    hasClosedDoorOnPath(game: ActiveGame, currentPos: Vec2, targetPos: Vec2): boolean {
        const dijkstraResult = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        const path = this.pathfindingService.reconstructPath(targetPos, dijkstraResult.predecessorKey);
        if (!path) return false;
        return path.some((step) => game.lobby.game.grid[step.y]?.[step.x]?.type === TileTexture.DoorClosed);
    }

    isEnemyReachableThisTurn(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2, enemyPos: Vec2): boolean {
        const remainingMp = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const { costToPosition } = this.pathfindingService.computeFullDijkstra(game, currentPos, true);
        return (Object.values(DIRECTION_OFFSETS) as Vec2[]).some((offset) => {
            const adj = { x: enemyPos.x + offset.x, y: enemyPos.y + offset.y };
            const cost = costToPosition.get(this.pathfindingService.positionKey(adj)) ?? Infinity;
            return cost <= remainingMp;
        });
    }

    isEnemyOnTile(game: ActiveGame, virtualPlayer: Player, pos: Vec2): boolean {
        return game.lobby.players.some((p) => {
            if (p.socketId === virtualPlayer.socketId || p.hasAbandonned) return false;
            if (!this.scanner.isOpponent(game, virtualPlayer, p)) return false;
            const pPos = game.playerPositions.get(p.socketId);
            return pPos !== undefined && pPos.x === pos.x && pPos.y === pos.y;
        });
    }

    ctfPathNeedsAp(game: ActiveGame, virtualPlayer: Player, currentPos: Vec2, targetPos: Vec2): boolean {
        return this.hasClosedDoorOnPath(game, currentPos, targetPos)
            || this.isEnemyOnTile(game, virtualPlayer, targetPos);
    }

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

    endVirtualPlayerTurn(lobbyId: string): void {
        setTimeout(() => this.gameLogicService.endTurn(lobbyId), this.getRandomActionDelay());
    }

    getRandomActionDelay(): number {
        return Math.floor(Math.random() * (VP_ACTION_DELAY_MAX_MS - VP_ACTION_DELAY_MIN_MS + 1)) + VP_ACTION_DELAY_MIN_MS;
    }

    getRandomTurnStartDelay(): number {
        return Math.floor(Math.random() * (VP_TURN_START_DELAY_MAX_MS - VP_TURN_START_DELAY_MIN_MS + 1)) + VP_TURN_START_DELAY_MIN_MS;
    }

    private getRandomStepDelay(): number {
        return Math.floor(Math.random() * (VP_STEP_DELAY_MAX_MS - VP_STEP_DELAY_MIN_MS + 1)) + VP_STEP_DELAY_MIN_MS;
    }
}
