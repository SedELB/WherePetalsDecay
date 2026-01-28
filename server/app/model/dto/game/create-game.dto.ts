import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { GAME_DESCRIPTION_AND_NAME_MIN_LENGTH, GAME_NAME_MAX_LENGTH } from './game.dto.constants';
// import { Tile } from '@app/model/schema/game.schema';
import { DoorState, GameMode, TileItem, TileType } from '@app/model/schema/game.constants';

export class TileDto {
    @IsEnum(TileType)
    type: TileType;

    @IsOptional() // car on peut avoir une tuile sans item
    @IsEnum(TileItem)
    item?: TileItem | null;

    @IsOptional()
    @IsEnum(DoorState)
    doorState?: DoorState;
}

class GameSizeDto {
    @IsNumber()
    rows: number;

    @IsNumber()
    cols: number;
}

export class CreateGameDto {
    @IsString()
    @MaxLength(GAME_NAME_MAX_LENGTH)
    @MinLength(GAME_DESCRIPTION_AND_NAME_MIN_LENGTH)
    name: string;

    @IsString()
    @MinLength(GAME_DESCRIPTION_AND_NAME_MIN_LENGTH)
    description: string;

    @IsObject()
    @ValidateNested() // Requis pour valider les propriétés internes de size
    @Type(() => GameSizeDto)
    size: GameSizeDto;

    @IsEnum(GameMode)
    gameMode: GameMode;

    @IsString()
    thumbnail: string;

    @IsNumber()
    maxPlayers: number;

    // The grid validation will be in the Controller method.
    @IsArray() // verifie que cest un tableau
    @IsArray({ each: true }) // ... un tableau de tableaux
    @ValidateNested({ each: true }) // entre dans TileDto et verifie selon les decorateurs
    @Type(() => TileDto) // transforme JSON en instance de TileDto
    grid: TileDto[][];

    @IsBoolean()
    isVisible: boolean;
}