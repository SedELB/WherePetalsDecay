import { IsString, MaxLength, IsBoolean, IsNumber, IsEnum, IsObject, IsArray, ValidateNested, IsOptional} from 'class-validator';
import { GAME_NAME_MAX_LENGTH } from './game.dto.constants';
import { Type } from 'class-transformer';
// import { Tile } from '@app/model/schema/game.schema';
import { GameMode, TileType, DoorState, TileItem } from '@app/model/schema/game.constants';

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
    name: string;

    @IsString()
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