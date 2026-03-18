import { TileTexture } from '../enums';
import { PlacedObject } from '../game';
import { GridSize } from './grid-size';

export interface GameDraftForValidation {
    id?: string;
    name: string;
    description: string;
    mode: string;
    size: GridSize;
    grid: TileTexture[][];
    placedObjects: PlacedObject[];
    existingNames?: string[];
}

export interface GameValidationResult {
    isValid: boolean;
    errors: string[];
}
