import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';
import { Vec2 } from '@common/vec2';
import { TileItem, TileTexture } from '@common/enums';
import { Player } from '@common/player';
import { TILE_COSTS } from '@common/tile-costs';

@Injectable()
export class CTFService {
    isThereFlag(game: ActiveGame, pos: Vec2 | null): boolean {
        if (!pos) return false;
        if (game.lobby.game.grid[pos.y][pos.x].item === TileItem.Flag) {
            return true;
        } else {
            return false;
        }
    }

    removeFlagFromTile(game: ActiveGame, pos: Vec2): void {
        game.lobby.game.grid[pos.y][pos.x].item = null;
    }

    setFlagOnNearestValidTile(game: ActiveGame, pos: Vec2, flagHolderId?: string): void {
        const targetPos = this.findNearestValidTile(game, pos, flagHolderId);
        if (targetPos) {
            game.lobby.game.grid[targetPos.y][targetPos.x].item = TileItem.Flag;
        }
    }

    private findNearestValidTile(game: ActiveGame, startPos: Vec2, flagHolderId?: string): Vec2 | null {
        if (this.isValidForFlag(game, startPos, flagHolderId)) {
            return startPos;
        }

        const queue: Vec2[] = [startPos];
        const visited = new Set<string>();
        visited.add(`${startPos.x},${startPos.y}`);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = [
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 },
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y },
            ];

            for (const neighbor of neighbors) {
                if (!this.isWithinBounds(game, neighbor)) continue;
                const key = `${neighbor.x},${neighbor.y}`;
                if (visited.has(key)) continue;
                visited.add(key);

                if (this.isValidForFlag(game, neighbor, flagHolderId)) {
                    return neighbor;
                }
                queue.push(neighbor);
            }
        }
        return null;
    }

    private isValidForFlag(game: ActiveGame, pos: Vec2, flagHolderId?: string): boolean {
        const tile = game.lobby.game.grid[pos.y][pos.x];
        const isOccupiedByPlayer = Array.from(game.playerPositions.entries()).some(
            ([socketId, playerPos]) => socketId !== flagHolderId && playerPos.x === pos.x && playerPos.y === pos.y,
        );

        const hasItem = tile.item !== null;
        const isDoorOpened = tile.type === TileTexture.DoorOpened;
        const isObstacle = TILE_COSTS[tile.type] === Infinity;

        return !isOccupiedByPlayer && !hasItem && !isDoorOpened && !isObstacle;
    }

    private isWithinBounds(game: ActiveGame, pos: Vec2): boolean {
        const grid = game.lobby.game.grid;
        return pos.y >= 0 && pos.y < grid.length && pos.x >= 0 && pos.x < grid[0].length;
    }

    wasFlagTransfered(game: ActiveGame, giverPlayerId: string, targetPlayerId: string): boolean {
        const giverPlayer = game.lobby.players.find(p => p.socketId === giverPlayerId);
        const targetPlayer = game.lobby.players.find(p => p.socketId === targetPlayerId);
        if (!giverPlayer || !targetPlayer) return false;
        
        if (giverPlayer.hasFlag) {
            targetPlayer.hasFlag = true;
            giverPlayer.hasFlag = false;
            return true;
        } else {
            return false;
        }
    }

    checkWinCondition(game: ActiveGame, flagOwnerId: string, flagOwnerPos: Vec2): Player | null {
        const flagPlayer = game.lobby.players.find(p => p.socketId === flagOwnerId);
        const flagPlayerSpawn = game.playerStartPositions.get(flagOwnerId);
        if (!flagPlayer) return;

        if (flagPlayer.hasFlag && flagOwnerPos.x === flagPlayerSpawn.x && flagOwnerPos.y === flagPlayerSpawn.y){
            return flagPlayer;
        } else {
            return null;
        }
    }


}