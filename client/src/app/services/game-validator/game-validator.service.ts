import { Injectable } from '@angular/core';
import { NAME_MAX_LENGTH, DESC_MAX_LENGTH, TEXT_MIN_LENGTH, FLAG_REQUIRED, FLAG_NONE } from '@common/constants/validation.constants';
import { GameMode, GridSizes, MaxPlayers, SanctuaryCount, TileItem, TileTexture } from '@common/enums';
import { PlacedObject } from '@common/game';
import { GameDraftForValidation, GameValidationResult } from '@common/interfaces/game-validation';
import { GridSize } from '@common/interfaces/grid-size';

export { NAME_MAX_LENGTH, DESC_MAX_LENGTH };

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

        if (!draft.mode || typeof draft.mode !== 'string') {
            errors.push('Le mode de jeu est requis !');
        }

        if (!draft.grid || !Array.isArray(draft.grid)) {
            errors.push('La grille du jeu est requise !');
        }

        if (!draft.size || typeof draft.size.rows !== 'number' || typeof draft.size.cols !== 'number') {
            errors.push('La taille du jeu est invalide !');
        }

        if (!draft.placedObjects || !Array.isArray(draft.placedObjects)) {
            errors.push('Les objets placés sont requis !');
        }

        return errors;
    }

    private validateTextLength(name: string, description: string): string[] {
        const errors: string[] = [];

        if ((name ?? '').trim().length < TEXT_MIN_LENGTH) {
            errors.push('Le champ nom est vide !');
        } else if (name.length > NAME_MAX_LENGTH) {
            errors.push('Le champ nom dépasse la longueur maximale !');
        }

        if ((description ?? '').trim().length < TEXT_MIN_LENGTH) {
            errors.push('Le champ description est vide !');
        } else if (description.length > DESC_MAX_LENGTH) {
            errors.push('Le champ description dépasse la longueur maximale !');
        }

        return errors;
    }

    private validateGameMode(mode: string): string[] {
        const validModes = Object.values(GameMode);
        if (!validModes.includes(mode as GameMode)) {
            return [`Le mode de jeu doit être l'un de : ${validModes.join(', ')}`];
        }
        return [];
    }

    private validateGridSize(size: GridSize, grid: TileTexture[][]): string[] {
        const errors: string[] = [];

        const validSizes = [GridSizes.Small, GridSizes.Medium, GridSizes.Large];
        if (!validSizes.includes(size.rows) || size.rows !== size.cols) {
            errors.push(`La grille doit être carrée et de taille : ${validSizes.join('x')}, ${validSizes.join('x')}, ${validSizes.join('x')}`);
        }

        if (size.rows <= 0 || size.cols <= 0) {
            errors.push('Les dimensions de la grille doivent être positives !');
            return errors;
        }

        if (!grid || grid.length === 0) {
            errors.push('La grille est vide !');
            return errors;
        }

        if (grid.length !== size.rows) {
            errors.push('Le nombre de lignes de la grille ne correspond pas à la taille spécifiée !');
        }

        const colsValid = grid.every((row) => Array.isArray(row) && row.length === size.cols);
        if (!colsValid) {
            errors.push('Le nombre de colonnes de la grille ne correspond pas à la taille spécifiée !');
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
                    errors.push(`Type de case invalide à la position (${row}, ${col}) : ${tileType}`);
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
                errors.push(`Type d'objet placé invalide : ${obj.type}`);
            }

            if (!obj.position || typeof obj.position.x !== 'number' || typeof obj.position.y !== 'number') {
                errors.push(`L'objet placé a une position invalide !`);
            }
        }

        return errors;
    }

    private validatePlacedObjectPositions(placedObjects: PlacedObject[], size: GridSize): string[] {
        const errors: string[] = [];

        for (const obj of placedObjects) {
            if (obj.position.x < 0 || obj.position.x >= size.cols || obj.position.y < 0 || obj.position.y >= size.rows) {
                errors.push(`L'objet placé à la position (${obj.position.y}, ${obj.position.x}) est hors limites !`);
            }
        }

        const positionSet = new Set<string>();
        for (const obj of placedObjects) {
            const key = `${obj.position.x},${obj.position.y}`;
            if (positionSet.has(key)) {
                errors.push(`Plusieurs objets placés à la même position : (${obj.position.y}, ${obj.position.x}) !`);
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
                errors.push(`On attend ${required} de ${itemName}(s) mais on trouve ${actual}!`);
            }
        }

        return errors;
    }

    private getRequiredObjectCounts(mapSize: number, mode: string): Record<TileItem, number> {
        const spawnCount =
            mapSize === GridSizes.Small ? MaxPlayers.Small : mapSize === GridSizes.Medium ? MaxPlayers.Medium : MaxPlayers.Large;
        const flagCount = mode === GameMode.Ctf ? FLAG_REQUIRED : FLAG_NONE;
        const sanctuaryCount =
            mapSize === GridSizes.Small ? SanctuaryCount.Small : mapSize === GridSizes.Medium ? SanctuaryCount.Medium : SanctuaryCount.Large;

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
