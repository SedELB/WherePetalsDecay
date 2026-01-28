import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { MAX_LENGTH, MAX_PLAYERS, MIN_LENGTH, MIN_PLAYERS  } from './game.dto.constants';
// import { Tile } from '@app/model/schema/game.schema';
import { GameMode, TileItem, TileTexture } from '@app/model/schema/game.constants';

export class TileDto {
    @IsEnum(TileTexture)
    type: TileTexture;

    @IsOptional() // car on peut avoir une tuile sans item
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
    @MaxLength(MAX_LENGTH)
    @MinLength(MIN_LENGTH)
    name: string;

    @IsString()
    @MinLength(MIN_LENGTH)
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
    @MinLength(MIN_PLAYERS)
    @MaxLength(MAX_PLAYERS)
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