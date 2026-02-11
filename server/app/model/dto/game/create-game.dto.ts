import { DESC_MAX_LENGTH, MAX_PLAYERS, MIN_PLAYERS, NAME_MAX_LENGTH, TEXT_MIN_LENGTH } from '@app/utils/game.constants';
import { GameMode, TileItem, TileTexture } from '@app/utils/game.enum';
import { Type } from 'class-transformer';
import {
    IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString,
    Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class TileDto {
    @IsEnum(TileTexture)
    type: TileTexture;

    @IsOptional()
    @IsEnum(TileItem)
    item?: TileItem;
}

class GameSizeDto {
    @IsNumber()
    rows: number;

    @IsNumber()
    cols: number;
}

export class CreateGameDto {
    @IsString()
    @MaxLength(NAME_MAX_LENGTH)
    @MinLength(TEXT_MIN_LENGTH)
    name: string;

    @IsString()
    @MaxLength(DESC_MAX_LENGTH)
    @MinLength(TEXT_MIN_LENGTH)
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
    @Min(MIN_PLAYERS)
    @Max(MAX_PLAYERS)
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