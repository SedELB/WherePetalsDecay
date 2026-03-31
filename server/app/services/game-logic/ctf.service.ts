import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';
import { Vec2 } from '@common/vec2';
import { TileItem } from '@common/enums';

@Injectable()
export class CTFService {
    isThereFlag(game: ActiveGame, pos: Vec2): boolean {
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
    
}