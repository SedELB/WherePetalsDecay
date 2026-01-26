import { IsString, MaxLength, IsDate, IsBoolean } from 'class-validator';
import { GAME_NAME_MAX_LENGTH } from './game.dto.constants';

export class CreateGameDto {
    @IsString()
    @MaxLength(GAME_NAME_MAX_LENGTH)
    name: string;

    @IsString()
    size: string;

    @IsString()
    _id: string;

    @IsString()
    gameMode: string;

    @IsDate()
    lastModified: Date;

    @IsString()
    thumbnail: string;

    // The grid validation will be in the Controller method.
    grid: number[][];

    @IsBoolean()
    isVisible: boolean;

    @IsString()
    description: string;
}