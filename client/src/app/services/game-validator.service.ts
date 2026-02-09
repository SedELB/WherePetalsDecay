import { Injectable } from '@angular/core';
import { PlacedObject } from '@app/interfaces/game';
import { GameMode, TileItem, TileTexture } from '@common/enums';

const NAME_MAX_LENGTH = 20;
const DESC_MAX_LENGTH = 500;
const TEXT_MIN_LENGTH = 1;
const MAP_SMALL_SIZE = 10;
const MAP_MEDIUM_SIZE = 15;
const MAP_LARGE_SIZE = 20;

export interface GameValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface GameDraftForValidation {
    id?: string;
    name: string;
    description: string;
    mode: string;
    size: { rows: number; cols: number };
    grid: TileTexture[][];
    placedObjects: PlacedObject[];
    existingNames?: string[];
}

@Injectable({
    providedIn: 'root',
})
export class GameValidatorService {
    validate(draft: GameDraftForValidation): GameValidationResult {
        const errors: string[] = [];

        errors.push(...this.validateRequiredFields(draft));
        errors.push(...this.validateTextLength(draft.name, draft.description));
        errors.push(...this.validateGameMode(draft.mode));
        errors.push(...this.validateGridSize(draft.size, draft.grid));
        errors.push(...this.validateTileTypes(draft.grid));
        errors.push(...this.validatePlacedObjects(draft));

        return { isValid: errors.length === 0, errors };
    }

    private validateRequiredFields(draft: GameDraftForValidation): string[] {
        const errors: string[] = [];

        if (!draft.name || typeof draft.name !== 'string') {
            errors.push('Game name is required!');
        }

        if (!draft.description || typeof draft.description !== 'string') {
            errors.push('Game description is required!');
        }

        if (!draft.mode || typeof draft.mode !== 'string') {
            errors.push('Game mode is required!');
        }

        if (!draft.grid || !Array.isArray(draft.grid)) {
            errors.push('Game grid is required!');
        }

        if (!draft.size || typeof draft.size.rows !== 'number' || typeof draft.size.cols !== 'number') {
            errors.push('Game size is invalid!');
        }

        if (!draft.placedObjects || !Array.isArray(draft.placedObjects)) {
            errors.push('Placed objects are required!');
        }

        return errors;
    }

    private validateTextLength(name: string, description: string): string[] {
        const errors: string[] = [];

        if ((name ?? '').trim().length < TEXT_MIN_LENGTH) {
            errors.push('The name field is empty!');
        } else if (name.length > NAME_MAX_LENGTH) {
            errors.push('The name field exceeds the maximum length!');
        }

        if ((description ?? '').trim().length < TEXT_MIN_LENGTH) {
            errors.push('The description field is empty!');
        } else if (description.length > DESC_MAX_LENGTH) {
            errors.push('The description field exceeds the maximum length!');
        }

        return errors;
    }

    private validateGameMode(mode: string): string[] {
        const validModes = Object.values(GameMode);
        if (!validModes.includes(mode as GameMode)) {
            return [`Game mode must be one of: ${validModes.join(', ')}`];
        }
        return [];
    }

    private validateGridSize(size: { rows: number; cols: number }, grid: TileTexture[][]): string[] {
        const errors: string[] = [];

        const validSizes = [MAP_SMALL_SIZE, MAP_MEDIUM_SIZE, MAP_LARGE_SIZE];
        if (!validSizes.includes(size.rows) || size.rows !== size.cols) {
            errors.push(`Grid size must be square and one of: ${validSizes.join('x')}, ${validSizes.join('x')}, ${validSizes.join('x')}`);
        }

        if (size.rows <= 0 || size.cols <= 0) {
            errors.push('Grid dimensions must be positive!');
            return errors;
        }

        if (!grid || grid.length === 0) {
            errors.push('Grid is empty!');
            return errors;
        }

        if (grid.length !== size.rows) {
            errors.push('Grid rows do not match the specified size!');
        }

        const colsValid = grid.every((row) => Array.isArray(row) && row.length === size.cols);
        if (!colsValid) {
            errors.push('Grid columns do not match the specified size!');
        }

        return errors;
    }

    private validateTileTypes(grid: TileTexture[][]): string[] {
        const errors: string[] = [];
        const validTileTypes = Object.values(TileTexture);

        for (let row = 0; row < grid.length; row++) {
            for (let col = 0; col < grid[row].length; col++) {
                const tileType = grid[row][col];
                if (!validTileTypes.includes(tileType)) {
                    errors.push(`Invalid tile type at position (${row}, ${col}): ${tileType}`);
                }
            }
        }

        return errors;
    }

    private validatePlacedObjects(draft: GameDraftForValidation): string[] {
        const errors: string[] = [];

        if (!draft.placedObjects || !Array.isArray(draft.placedObjects)) {
            return errors;
        }

        errors.push(...this.validatePlacedObjectTypes(draft.placedObjects));
        errors.push(...this.validatePlacedObjectPositions(draft.placedObjects, draft.size));
        errors.push(...this.validateRequiredObjectCounts(draft));

        return errors;
    }

    private validatePlacedObjectTypes(placedObjects: PlacedObject[]): string[] {
        const errors: string[] = [];
        const validItemTypes = Object.values(TileItem);

        for (const obj of placedObjects) {
            if (!validItemTypes.includes(obj.type)) {
                errors.push(`Invalid placed object type: ${obj.type}`);
            }

            if (!obj.position || typeof obj.position.x !== 'number' || typeof obj.position.y !== 'number') {
                errors.push('Placed object has invalid position!');
            }
        }

        return errors;
    }

    private validatePlacedObjectPositions(placedObjects: PlacedObject[], size: { rows: number; cols: number }): string[] {
        const errors: string[] = [];

        for (const obj of placedObjects) {
            if (obj.position.x < 0 || obj.position.x >= size.cols || obj.position.y < 0 || obj.position.y >= size.rows) {
                errors.push(`Placed object at position (${obj.position.y}, ${obj.position.x}) is out of bounds!`);
            }
        }

        const positionSet = new Set<string>();
        for (const obj of placedObjects) {
            const key = `${obj.position.x},${obj.position.y}`;
            if (positionSet.has(key)) {
                errors.push(`Multiple objects placed at the same position (${obj.position.y}, ${obj.position.x})!`);
            }
            positionSet.add(key);
        }

        return errors;
    }

    private validateRequiredObjectCounts(draft: GameDraftForValidation): string[] {
        const errors: string[] = [];

        const requiredCounts = this.getRequiredObjectCounts(draft.size.rows, draft.mode);
        const actualCounts = this.countPlacedObjects(draft.placedObjects);

        for (const [type, required] of Object.entries(requiredCounts)) {
            const actual = actualCounts[type as TileItem] || 0;
            if (actual !== required) {
                const itemName = this.getItemName(type as TileItem);
                errors.push(`Expected ${required} ${itemName}(s) but found ${actual}!`);
            }
        }

        return errors;
    }

    private getRequiredObjectCounts(mapSize: number, mode: string): Record<TileItem, number> {
        const spawnCount = mapSize === MAP_SMALL_SIZE ? 2 : mapSize === MAP_MEDIUM_SIZE ? 4 : 6;
        const sanctuaryCount = mapSize === MAP_SMALL_SIZE ? 1 : mapSize === MAP_MEDIUM_SIZE ? 2 : 4;
        const flagCount = mode === GameMode.Ctf ? 1 : 0;

        return {
            [TileItem.Spawn]: spawnCount,
            [TileItem.HealingSanctuary]: sanctuaryCount,
            [TileItem.CombatSanctuary]: sanctuaryCount,
            [TileItem.Flag]: flagCount,
        };
    }

    private countPlacedObjects(placedObjects: PlacedObject[]): Record<TileItem, number> {
        const counts: Record<TileItem, number> = {
            [TileItem.Spawn]: 0,
            [TileItem.Flag]: 0,
            [TileItem.HealingSanctuary]: 0,
            [TileItem.CombatSanctuary]: 0,
        };

        for (const obj of placedObjects) {
            if (obj.type in counts) {
                counts[obj.type]++;
            }
        }

        return counts;
    }

    private getItemName(type: TileItem): string {
        switch (type) {
            case TileItem.Spawn:
                return 'spawn point';
            case TileItem.Flag:
                return 'flag';
            case TileItem.HealingSanctuary:
                return 'healing sanctuary';
            case TileItem.CombatSanctuary:
                return 'combat sanctuary';
            default:
                return 'item';
        }
    }
}

