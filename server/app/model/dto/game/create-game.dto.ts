import { IsString, MaxLength, IsBoolean, IsNumber } from 'class-validator';
import { GAME_NAME_MAX_LENGTH } from './game.dto.constants';
import { Tile } from '@app/model/schema/game.schema';


export class CreateGameDto {
    @IsString()
    @MaxLength(GAME_NAME_MAX_LENGTH)
    name: string;

    @IsString()
    size: object;

    @IsString()
    gameMode: string;

    @IsString()
    thumbnail: string;

    // The grid validation will be in the Controller method.
    grid: Tile[][];

    @IsBoolean()
    isVisible: boolean;

    @IsNumber()
    maxPlayers: number;

    @IsString()
    description: string;
}