/**
 * Testing:
 * - Game validation for required fields
 * - Text length validation (name, description)
 * - Game mode and grid size validation
 * - Tile texture validation
 * - Placed object validation (types, positions, counts)
 */

import { GameValidatorService } from '@app/services/game-validator/game-validator.service';
import type { GameDraftForValidation } from '@common/interfaces/game-validation';
import { GameMode, GridSizes, MaxPlayers, TileItem, TileTexture } from '@common/enums';
import type { PlacedObject } from '@common/game';

type GameValidatorServiceInternal = {
    validateRequiredFields: (draft: GameDraftForValidation) => string[];
    getRequiredObjectCounts: (size: number, mode: GameMode) => Record<TileItem, number>;
    getItemName: (item: TileItem | string) => string;
};

const SIZE_SMALL = GridSizes.Small;
const SIZE_MEDIUM = GridSizes.Medium;
const SIZE_LARGE = GridSizes.Large;
const SIZE_INVALID = 11;
const SIZE_INVALID_OTHER = 12;
const GRID_MISMATCH = 9;
const NAME_TOO_LONG = 21;
const DESCRIPTION_TOO_LONG = 501;
const SPAWN_SMALL = MaxPlayers.Small;
const SPAWN_MEDIUM = MaxPlayers.Medium;
const SPAWN_LARGE = MaxPlayers.Large;

const buildGrid = (rows: number, cols: number, tile: TileTexture = TileTexture.Floor): TileTexture[][] =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => tile));

const baseObjects = (mode: GameMode): PlacedObject[] => {
    const objects: PlacedObject[] = [
        { type: TileItem.Spawn, position: { x: 0, y: 0 } },
        { type: TileItem.Spawn, position: { x: 1, y: 0 } },
        { type: TileItem.HealingSanctuary, position: { x: 3, y: 0 } },
        { type: TileItem.CombatSanctuary, position: { x: 4, y: 0 } },
    ];

    if (mode === GameMode.Ctf) {
        objects.push({ type: TileItem.Flag, position: { x: 2, y: 2 } });
    }

    return objects;
};

const draft = (overrides: Partial<GameDraftForValidation> = {}): GameDraftForValidation => {
    const mode = overrides.mode ?? GameMode.Classic;
    const size = overrides.size ?? { rows: SIZE_SMALL, cols: SIZE_SMALL };

    return {
        name: 'Test game',
        description: 'Test description',
        mode,
        size,
        grid: buildGrid(size.rows, size.cols),
        placedObjects: baseObjects(GameMode.Classic),
        ...overrides,
    };
};

describe('GameValidatorService', () => {
    let service: GameValidatorService;
    let internal: GameValidatorServiceInternal;

    beforeEach(() => {
        service = new GameValidatorService();
        internal = service as unknown as GameValidatorServiceInternal;
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test valid game draft
    it('should return valid for a correct draft', () => {
        const result = service.validate(draft());
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    // Test missing required fields
    it('should report missing name field', () => {
        const broken = draft({ name: '' });
        const errors = service.validate(broken).errors;
        expect(errors).toContain('Le champ nom est vide !');
    });

    it('should report missing description field', () => {
        const broken = draft({ description: '' });
        const errors = service.validate(broken).errors;
        expect(errors).toContain('Le champ description est vide !');
    });

    it('should report missing mode field', () => {
        const broken = draft({ mode: '' as unknown as GameMode });
        const errors = service.validate(broken).errors;
        expect(errors).toContain('Le mode de jeu est requis !');
    });

    it('should report invalid grid field', () => {
        const broken = draft({ grid: null as unknown as TileTexture[][] });
        const errors = internal.validateRequiredFields(broken);
        expect(errors).toContain('La grille du jeu est requise !');
    });

    it('should report invalid size field', () => {
        const broken = draft({ size: { rows: 'x', cols: 'y' } as unknown as { rows: number; cols: number } });
        const errors = service.validate(broken).errors;
        expect(errors).toContain('La taille du jeu est invalide !');
    });

    it('should report missing placedObjects field', () => {
        const broken = draft({ placedObjects: null as unknown as PlacedObject[] });
        const errors = service.validate(broken).errors;
        expect(errors).toContain('Les objets placés sont requis !');
    });

    // Test text length validation
    it('should reject name that is too long', () => {
        const tooLong = draft({ name: 'a'.repeat(NAME_TOO_LONG) });
        const errors = service.validate(tooLong).errors;
        expect(errors).toContain('Le champ nom dépasse la longueur maximale !');
    });

    it('should reject description that is too long', () => {
        const tooLong = draft({ description: 'b'.repeat(DESCRIPTION_TOO_LONG) });
        const errors = service.validate(tooLong).errors;
        expect(errors).toContain('Le champ description dépasse la longueur maximale !');
    });

    // Whitespace fields
    it('should reject whitespace only name', () => {
        const whitespace = draft({ name: '   ' });
        const errors = service.validate(whitespace).errors;
        expect(errors).toContain('Le champ nom est vide !');
    });

    it('should reject whitespace only description', () => {
        const whitespace = draft({ description: '   ' });
        const errors = service.validate(whitespace).errors;
        expect(errors).toContain('Le champ description est vide !');
    });

    // Test game mode validation
    it('should reject invalid game mode', () => {
        const badMode = draft({ mode: 'invalid' as unknown as GameMode, placedObjects: baseObjects('invalid' as unknown as GameMode) });
        const errors = service.validate(badMode).errors;
        expect(errors.some((e) => e.includes('mode de jeu'))).toBe(true);
    });

    it('should accept all valid game modes', () => {
        const classicResult = service.validate(draft({ mode: GameMode.Classic, placedObjects: baseObjects(GameMode.Classic) }));
        expect(classicResult.isValid).toBe(true);

        const ctfResult = service.validate(draft({ mode: GameMode.Ctf, placedObjects: baseObjects(GameMode.Ctf) }));
        expect(ctfResult.isValid).toBe(true);
    });

    // Test grid size validation
    it('should reject zero or negative grid dimensions', () => {
        const badSize = draft({ size: { rows: 0, cols: 0 }, grid: buildGrid(1, 1) });
        const errors = service.validate(badSize).errors;
        expect(errors).toContain('Les dimensions de la grille doivent être positives !');
    });

    it('should reject non-square grids', () => {
        const badSize = draft({ size: { rows: SIZE_INVALID, cols: SIZE_INVALID }, grid: buildGrid(SIZE_INVALID, SIZE_INVALID) });
        const errors = service.validate(badSize).errors;
        expect(errors.some((e) => e.includes('La grille doit être carrée'))).toBe(true);
    });

    it('should reject row count mismatch', () => {
        const rowMismatch = draft({ grid: buildGrid(GRID_MISMATCH, SIZE_SMALL) });
        const errors = service.validate(rowMismatch).errors;
        expect(errors).toContain('Le nombre de lignes de la grille ne correspond pas à la taille spécifiée !');
    });

    it('should reject column count mismatch', () => {
        const colMismatchGrid = buildGrid(SIZE_SMALL, SIZE_SMALL);
        colMismatchGrid[0] = Array.from({ length: GRID_MISMATCH }, () => TileTexture.Floor);
        const colMismatch = draft({ grid: colMismatchGrid });
        const errors = service.validate(colMismatch).errors;
        expect(errors).toContain('Le nombre de colonnes de la grille ne correspond pas à la taille spécifiée !');
    });

    // Empty grid
    it('should reject empty grid', () => {
        const emptyGrid = draft({ grid: [] as TileTexture[][] });
        const errors = service.validate(emptyGrid).errors;
        expect(errors).toContain('La grille est vide !');
    });

    // Test tile texture validation
    it('should reject unknown tile textures', () => {
        const grid = buildGrid(SIZE_SMALL, SIZE_SMALL);
        grid[0][0] = 'lava' as TileTexture;

        const errors = service.validate(draft({ grid, placedObjects: baseObjects(GameMode.Classic) })).errors;
        expect(errors.some((e) => e.includes('Type de case invalide'))).toBe(true);
    });

    it('should accept all valid tile textures', () => {
        const grid = buildGrid(SIZE_SMALL, SIZE_SMALL);
        grid[0][0] = TileTexture.Floor;
        grid[0][1] = TileTexture.Wall;
        grid[1][0] = TileTexture.DoorOpened;

        const result = service.validate(draft({ grid }));
        expect(result.isValid).toBe(true);
    });

    // Test placed object type validation
    it('should reject invalid placed object type', () => {
        const placedObjects = [...baseObjects(GameMode.Classic), { type: 'invalid' as TileItem, position: { x: 0, y: 0 } }];
        const errors = service.validate(draft({ placedObjects })).errors;
        expect(errors.some((e) => e.includes('objet placé invalide'))).toBe(true);
    });

    it('should reject placed object with invalid position', () => {
        const invalidPosition = { x: 'a', y: 0 } as unknown as { x: number; y: number };
        const placedObjects = [...baseObjects(GameMode.Classic), { type: TileItem.Spawn, position: invalidPosition }];
        const errors = service.validate(draft({ placedObjects })).errors;
        expect(errors.some((e) => e.includes('position invalide'))).toBe(true);
    });

    // Test placed object position validation
    it('should reject out-of-bounds positions', () => {
        const placedObjects: PlacedObject[] = [
            { type: TileItem.Spawn, position: { x: -1, y: 0 } },
            { type: TileItem.Spawn, position: { x: 0, y: SIZE_SMALL } },
        ];

        const errors = service.validate(draft({ placedObjects })).errors;
        expect(errors.some((e) => e.includes('est hors limites !'))).toBe(true);
    });

    // Duplicate positions
    it('should reject multiple objects at same position', () => {
        const duplicates: PlacedObject[] = [
            { type: TileItem.Spawn, position: { x: 0, y: 0 } },
            { type: TileItem.Flag, position: { x: 0, y: 0 } },
        ];

        const errors = service.validate(draft({ placedObjects: duplicates })).errors;
        expect(errors.some((e) => e.includes('Plusieurs objets placés à la même position'))).toBe(true);
    });

    // Test required object counts for Classic mode
    it('should require correct spawn count for small Classic map', () => {
        const classicDraft = draft({
            mode: GameMode.Classic,
            size: { rows: SIZE_SMALL, cols: SIZE_SMALL },
            grid: buildGrid(SIZE_SMALL, SIZE_SMALL),
            placedObjects: [],
        });

        const errors = service.validate(classicDraft).errors;
        expect(errors.some((e) => e.includes(`On attend ${SPAWN_SMALL}`) && e.includes('spawn point'))).toBe(true);
    });

    it('should require correct spawn count for medium Classic map', () => {
        const mediumDraft = draft({
            mode: GameMode.Classic,
            size: { rows: SIZE_MEDIUM, cols: SIZE_MEDIUM },
            grid: buildGrid(SIZE_MEDIUM, SIZE_MEDIUM),
            placedObjects: [],
        });

        const errors = service.validate(mediumDraft).errors;
        expect(errors.some((e) => e.includes(`On attend ${SPAWN_MEDIUM}`) && e.includes('spawn point'))).toBe(true);
    });

    it('should require correct spawn count for large Classic map', () => {
        const largeDraft = draft({
            mode: GameMode.Classic,
            size: { rows: SIZE_LARGE, cols: SIZE_LARGE },
            grid: buildGrid(SIZE_LARGE, SIZE_LARGE),
            placedObjects: [],
        });

        const errors = service.validate(largeDraft).errors;
        expect(errors.some((e) => e.includes(`On attend ${SPAWN_LARGE}`) && e.includes('spawn point'))).toBe(true);
    });

    // Test required object counts for CTF mode
    it('should require flag for CTF mode', () => {
        const ctfDraft = draft({
            mode: GameMode.Ctf,
            size: { rows: SIZE_SMALL, cols: SIZE_SMALL },
            grid: buildGrid(SIZE_SMALL, SIZE_SMALL),
            placedObjects: baseObjects(GameMode.Classic),
        });

        const errors = service.validate(ctfDraft).errors;
        expect(errors.some((e) => e.includes('On attend 1') && e.includes('flag'))).toBe(true);
    });

    it('should not require flag for Classic mode', () => {
        const classicDraft = draft({
            mode: GameMode.Classic,
            size: { rows: SIZE_SMALL, cols: SIZE_SMALL },
            grid: buildGrid(SIZE_SMALL, SIZE_SMALL),
            placedObjects: baseObjects(GameMode.Classic),
        });

        const result = service.validate(classicDraft);
        expect(result.isValid).toBe(true);
    });

    // Test getRequiredObjectCounts for different sizes
    it('should return correct counts for small map', () => {
        const counts = internal.getRequiredObjectCounts(SIZE_SMALL, GameMode.Classic);
        expect(counts[TileItem.Spawn]).toBe(SPAWN_SMALL);
        expect(counts[TileItem.Flag]).toBe(0);
    });

    it('should return correct counts for medium map', () => {
        const counts = internal.getRequiredObjectCounts(SIZE_MEDIUM, GameMode.Classic);
        expect(counts[TileItem.Spawn]).toBe(SPAWN_MEDIUM);
    });

    it('should return correct counts for large map', () => {
        const counts = internal.getRequiredObjectCounts(SIZE_LARGE, GameMode.Classic);
        expect(counts[TileItem.Spawn]).toBe(SPAWN_LARGE);
    });

    it('should return flag count for CTF mode', () => {
        const counts = internal.getRequiredObjectCounts(SIZE_INVALID_OTHER, GameMode.Ctf);
        expect(counts[TileItem.Flag]).toBe(1);
    });

    // Test getItemName for all item types
    it('should return correct item names', () => {
        expect(internal.getItemName(TileItem.Spawn)).toBe('spawn point');
        expect(internal.getItemName(TileItem.Flag)).toBe('flag');
        expect(internal.getItemName(TileItem.HealingSanctuary)).toBe('healing sanctuary');
        expect(internal.getItemName(TileItem.CombatSanctuary)).toBe('combat sanctuary');
    });

    // Fallback item name
    it('should return fallback name for unknown item type', () => {
        expect(internal.getItemName('invalid' as TileItem)).toBe('item');
    });

    // Test complete valid game scenarios
    it('should validate complete small Classic game', () => {
        const result = service.validate(draft());
        expect(result.isValid).toBe(true);
    });

    it('should validate complete CTF game', () => {
        const ctfDraft = draft({
            mode: GameMode.Ctf,
            placedObjects: baseObjects(GameMode.Ctf),
        });

        const result = service.validate(ctfDraft);
        expect(result.isValid).toBe(true);
    });
});