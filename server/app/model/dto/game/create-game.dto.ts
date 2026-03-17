import { DESC_MAX_LENGTH, MAX_PLAYERS_DTO, MIN_PLAYERS_DTO, NAME_MAX_LENGTH, TEXT_MIN_LENGTH } from '@app/utils/game.constants';
import { GameMode, TileItem, TileTexture } from '@common/enums';
import { Type } from 'class-transformer';
import {
    IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString,
    Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

class TileDto {
    @IsEnum(TileTexture)
    type: TileTexture;

    @IsOptional()
    @IsEnum(TileItem)
    item: TileItem | null;
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
    @Min(MIN_PLAYERS_DTO)
    @Max(MAX_PLAYERS_DTO)
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
