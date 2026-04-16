import { Injectable } from '@nestjs/common';
import { Vec2 } from '@common/vec2';
import { ActiveGame } from '@app/services/game-logic/core/active-game.interface';
import { Player } from '@common/player';
import { TileTexture, TileItem, GameMode } from '@common/enums';
import { TILE_COSTS } from '@common/tile-costs';
import { VP_CONSTANTS } from '@app/constants/game-logic.constants';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';
import { GameLogicService } from '@app/services/game-logic/core/game-logic.service';
import { TurnContext } from '@app/interfaces/virtual-player.interface';

@Injectable()
export class VirtualPlayerMovementService {
    constructor(
        private readonly pathfindingService: VirtualPlayerPathfindingService,
        private readonly gameLogicService: GameLogicService,
    ) {}

    moveTowardThenActWithDoors(
        context: TurnContext,
        currentPos: Vec2,
        targetPos: Vec2,
        onDone: () => void,
        runDecisionCycle: (context: TurnContext) => void,
    ): void {
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
            game,
            fullPath,
            remainingMovement,
            virtualPlayer.socketId,
            canOpenDoorsNow,
        );

        if (!travelEndpoint) {
            this.handleNoTravelEndpoint(context, fullPath, canOpenDoorsNow, remainingMovement, onDone);
            return;
        }

        const travelPath = this.pathfindingService.reconstructPath(travelEndpoint, dijkstraResult.predecessorKey) ?? [];
        this.stepAlongPath(context, travelPath, 0, onDone, runDecisionCycle);
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
            this.gameLogicService.endTurn(context.lobbyId);
            return;
        }

        onDone();
    }

    stepAlongPath(
        context: TurnContext,
        path: Vec2[],
        stepIndex: number,
        onDone: () => void,
        runDecisionCycle: (context: TurnContext) => void,
    ): void {
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
            setTimeout(() => this.stepAlongPath(context, path, stepIndex, onDone, runDecisionCycle), VP_CONSTANTS.stepDelayMs);
            return;
        }

        if (!this.applyMovementStep(game, virtualPlayer, targetStep)) {
            onDone();
            return;
        }

        const movementPoints = game.movementPoints.get(virtualPlayer.socketId) ?? 0;
        const flagJustTaken = this.tryPickUpFlag(game, virtualPlayer, targetStep);

        server.to(lobbyId).emit(VP_CONSTANTS.eventPlayerMoved, {
            socketId: virtualPlayer.socketId,
            position: targetStep,
            movementPoints,
            flagTaken: flagJustTaken,
        });

        if (flagJustTaken && movementPoints > 0) {
            setTimeout(() => runDecisionCycle(context), VP_CONSTANTS.stepDelayMs);
            return;
        }

        setTimeout(() => this.stepAlongPath(context, path, stepIndex + 1, onDone, runDecisionCycle), VP_CONSTANTS.stepDelayMs);
    }

    tryToggleDoorAtPosition(context: TurnContext, doorPos: Vec2, expectedType: TileTexture): boolean {
        const { server, game, virtualPlayer, lobbyId } = context;

        const actionPoints = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        if (actionPoints <= 0) return false;

        const tile = game.lobby.game.grid[doorPos.y]?.[doorPos.x];
        if (tile?.type !== expectedType) return false;

        const result = this.gameLogicService.toggleDoor(lobbyId, virtualPlayer.socketId, doorPos);
        if (!result) return false;

        server.to(lobbyId).emit(VP_CONSTANTS.eventDoorToggled, {
            position: doorPos,
            newType: game.lobby.game.grid[doorPos.y][doorPos.x].type,
        });

        const updatedAp = game.actionPoints.get(virtualPlayer.socketId) ?? 0;
        server.to(lobbyId).emit(VP_CONSTANTS.eventActionPoints, { socketId: virtualPlayer.socketId, actionPoints: updatedAp });

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

    private trackTileVisitStats(game: ActiveGame, socketId: string, pos: Vec2): void {
        const tile = game.lobby.game.grid[pos.y]?.[pos.x];
        if (!tile) return;

        const key = this.pathfindingService.positionKey(pos);
        const isPassableTerrain =
            tile.type === TileTexture.Floor ||
            tile.type === TileTexture.Water ||
            tile.type === TileTexture.Ice ||
            tile.type === TileTexture.DoorOpened;

        if (isPassableTerrain) {
            if (!game.visitedTilesPerPlayer.has(socketId)) game.visitedTilesPerPlayer.set(socketId, new Set());
            const visited = game.visitedTilesPerPlayer.get(socketId);
            if (visited) visited.add(key);
            game.globalVisitedTiles.add(key);
        }

        if (tile.item === TileItem.HealingSanctuary || tile.item === TileItem.CombatSanctuary) game.sanctuariesUsed.add(key);
        if (tile.type === TileTexture.DoorOpened) game.doorsInteracted.add(key);
        if (tile.item === TileItem.Flag) game.flagHolders.add(socketId);
    }
}
