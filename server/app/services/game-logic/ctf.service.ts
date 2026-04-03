import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';
import { Vec2 } from '@common/vec2';
import { TileItem } from '@common/enums';
import { Player } from '@common/player';
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

    setFlagOnTile(game: ActiveGame, pos: Vec2): void {
        game.lobby.game.grid[pos.y][pos.x].item = TileItem.Flag;
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