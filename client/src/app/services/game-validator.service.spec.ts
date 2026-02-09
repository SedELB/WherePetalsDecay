import type { PlacedObject } from '@app/interfaces/game';
import { GameValidatorService, type GameDraftForValidation } from '@app/services/game-validator.service';
import { GameMode, TileItem, TileTexture } from '@common/enums';

type GameValidatorServiceInternal = {
    validateRequiredFields: (draft: GameDraftForValidation) => string[];
    getRequiredObjectCounts: (size: number, mode: GameMode) => Record<TileItem, number>;
    getItemName: (item: TileItem | string) => string;
};

const SIZE_SMALL = 10;
const SIZE_MEDIUM = 15;
const SIZE_LARGE = 20;
const SIZE_INVALID = 11;
const SIZE_INVALID_OTHER = 12;
const GRID_MISMATCH = 9;
const NAME_TOO_LONG = 21;
const DESCRIPTION_TOO_LONG = 501;
const SPAWN_SMALL = 2;
const SPAWN_MEDIUM = 4;
const SPAWN_LARGE = 6;

const buildGrid = (rows: number, cols: number, tile: TileTexture = TileTexture.Floor): TileTexture[][] =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => tile));

const baseObjects = (mode: GameMode): PlacedObject[] => {
    const objects: PlacedObject[] = [
        { type: TileItem.Spawn, position: { x: 0, y: 0 } },
        { type: TileItem.Spawn, position: { x: 1, y: 0 } },
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

    it('returns valid for a correct draft', () => {
        const result = service.validate(draft());
        expect(result.isValid).toBeTrue();
        expect(result.errors.length).toBe(0);
    });

    it('reports missing required fields and invalid lengths', () => {
        const broken = draft({
            name: '',
            description: '',
            mode: '' as unknown as GameMode,
            grid: [] as TileTexture[][],
            size: { rows: 'x', cols: 'y' } as unknown as { rows: number; cols: number },
            placedObjects: null as unknown as PlacedObject[],
        });

        const errors = service.validate(broken).errors;
        expect(errors).toContain('Game name is required!');
        expect(errors).toContain('Game description is required!');
        expect(errors).toContain('Game mode is required!');
        expect(errors).toContain('Game size is invalid!');
        expect(errors).toContain('Placed objects are required!');

        const tooLong = draft({
            name: 'a'.repeat(NAME_TOO_LONG),
            description: 'b'.repeat(DESCRIPTION_TOO_LONG),
        });

        const lengthErrors = service.validate(tooLong).errors;
        expect(lengthErrors).toContain('The name field exceeds the maximum length!');
        expect(lengthErrors).toContain('The description field exceeds the maximum length!');

        const requiredErrors = internal.validateRequiredFields({
            ...draft(),
            grid: null as unknown as TileTexture[][],
        });

        expect(requiredErrors).toContain('Game grid is required!');
    });

    it('validates game mode and grid dimensions', () => {
        const badMode = draft({ mode: 'invalid' as unknown as GameMode });
        const modeErrors = service.validate(badMode).errors;
        expect(modeErrors.some((e) => e.startsWith('Game mode must be one of:'))).toBeTrue();

        const badSize = draft({ size: { rows: 0, cols: 0 }, grid: buildGrid(1, 1) });
        const sizeErrors = service.validate(badSize).errors;
        expect(sizeErrors).toContain('Grid size must be square and one of: 10x15x20, 10x15x20, 10x15x20');
        expect(sizeErrors).toContain('Grid dimensions must be positive!');

        const rowMismatch = draft({ grid: buildGrid(GRID_MISMATCH, SIZE_SMALL) });
        expect(service.validate(rowMismatch).errors).toContain('Grid rows do not match the specified size!');

        const colMismatchGrid = buildGrid(SIZE_SMALL, SIZE_SMALL);
        colMismatchGrid[0] = Array.from({ length: GRID_MISMATCH }, () => TileTexture.Floor);
        const colMismatch = draft({ grid: colMismatchGrid });
        expect(service.validate(colMismatch).errors).toContain('Grid columns do not match the specified size!');

        const emptyGrid = draft({ grid: [] as TileTexture[][] });
        expect(service.validate(emptyGrid).errors).toContain('Grid is empty!');
    });

    it('rejects unknown tile textures', () => {
        const grid = buildGrid(SIZE_SMALL, SIZE_SMALL);
        grid[0][0] = 'lava' as TileTexture;

        const result = service.validate(draft({ grid }));
        expect(result.errors.some((e) => e.startsWith('Invalid tile type at position (0, 0):'))).toBeTrue();
    });

    it('validates placed object types and positions (including duplicates)', () => {
        const placedObjects = [
            { type: 'invalid' as TileItem, position: { x: 0, y: 0 } },
            { type: TileItem.Spawn, position: { x: 'a', y: 0 } as unknown as { x: number; y: number } },
        ];

        const errors = service.validate(draft({ placedObjects })).errors;
        expect(errors).toContain('Invalid placed object type: invalid');
        expect(errors).toContain('Placed object has invalid position!');

        const duplicates: PlacedObject[] = [
            { type: TileItem.Spawn, position: { x: -1, y: 0 } },
            { type: TileItem.Spawn, position: { x: 0, y: 0 } },
            { type: TileItem.Flag, position: { x: 0, y: 0 } },
        ];

        const duplicateErrors = service.validate(draft({ placedObjects: duplicates })).errors;
        expect(duplicateErrors.some((e) => e.includes('is out of bounds!'))).toBeTrue();
        expect(duplicateErrors.some((e) => e.includes('Multiple objects placed at the same position'))).toBeTrue();
    });

    it('checks required object counts and the fallback naming', () => {
        const ctfDraft = draft({
            mode: GameMode.Ctf,
            size: { rows: SIZE_INVALID, cols: SIZE_INVALID },
            grid: buildGrid(SIZE_INVALID, SIZE_INVALID),
            placedObjects: [],
        });

        const errors = service.validate(ctfDraft).errors;
        expect(errors.some((e) => e.includes('Expected'))).toBeTrue();
        expect(errors.some((e) => e.includes('spawn point'))).toBeTrue();
        expect(errors.some((e) => e.includes('flag'))).toBeTrue();

        const small = internal.getRequiredObjectCounts(SIZE_SMALL, GameMode.Classic);
        const medium = internal.getRequiredObjectCounts(SIZE_MEDIUM, GameMode.Classic);
        const large = internal.getRequiredObjectCounts(SIZE_LARGE, GameMode.Classic);
        const other = internal.getRequiredObjectCounts(SIZE_INVALID_OTHER, GameMode.Ctf);

        expect(small[TileItem.Spawn]).toBe(SPAWN_SMALL);
        expect(medium[TileItem.Spawn]).toBe(SPAWN_MEDIUM);
        expect(large[TileItem.Spawn]).toBe(SPAWN_LARGE);
        expect(other[TileItem.Flag]).toBe(1);
        expect(internal.getItemName('invalid')).toBe('item');
    });
});
