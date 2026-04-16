/**
 * @file game-validator.service.spec.ts
 *
 * Test suite for GameValidatorService (validation logicielle).
 *
 * Covers every business rule that governs a valid game draft:
 *  - Required-field presence  (mode, grid, size, placedObjects)
 *  - Text-length constraints  (name & description min/max)
 *  - Game-mode enumeration    (Classic / CTF only)
 *  - Grid-dimension rules     (square, valid enum sizes, matching row/col counts)
 *  - Tile-texture enumeration (every cell must be a known TileTexture)
 *  - Placed-object types      (only valid TileItem values accepted)
 *  - Placed-object positions  (within bounds, no duplicates)
 *  - Required-object counts   (spawn, sanctuary, flag counts per map size & mode)
 */

import { GameValidatorService } from '@app/services/game-validator/game-validator.service';
import type { GameDraftForValidation } from '@common/interfaces/game-validation';
import { GameMode, GridSizes, MaxPlayers, SanctuaryCount, TileItem, TileTexture } from '@common/enums';
import type { PlacedObject } from '@common/game';

// ─── Private-method access helper type ────────────────────────────────────────
type GameValidatorServiceInternal = {
    validateRequiredFields: (d: GameDraftForValidation) => string[];
    validateTextLength: (n: string, d: string) => string[];
    validateGameMode: (m: string) => string[];
    validateGridSize: (s: { rows: number; cols: number }, g: TileTexture[][]) => string[];
    validateTileTypes: (g: TileTexture[][]) => string[];
    validatePlacedObjectTypes: (o: PlacedObject[]) => string[];
    validatePlacedObjectPositions: (o: PlacedObject[], s: { rows: number; cols: number }) => string[];
    validateRequiredObjectCounts: (d: GameDraftForValidation) => string[];
    getRequiredObjectCounts: (sz: number, m: GameMode) => Record<TileItem, number>;
    countPlacedObjects: (o: PlacedObject[]) => Record<TileItem, number>;
    getItemName: (t: TileItem | string) => string;
};

// ─── Named constants (avoids @typescript-eslint/no-magic-numbers) ─────────────
const SIZE_SMALL = GridSizes.Small;
const SIZE_MEDIUM = GridSizes.Medium;
const SIZE_LARGE = GridSizes.Large;
const SIZE_INVALID = 11;
const SIZE_INVALID_FOR_LARGE = 21;
const GRID_MISMATCH = 9;
const NAME_TOO_LONG = 21;
const DESC_TOO_LONG = 501;
const SPAWN_SMALL = MaxPlayers.Small;
const SPAWN_MEDIUM = MaxPlayers.Medium;
const SPAWN_LARGE = MaxPlayers.Large;
const SANCTUARY_SMALL = SanctuaryCount.Small;
const SANCTUARY_MEDIUM = SanctuaryCount.Medium;
const SANCTUARY_LARGE = SanctuaryCount.Large;
const FLAG_CTF = 1;
const FLAG_CLASSIC = 0;

// ─── Factories ────────────────────────────────────────────────────────────────

const buildGrid = (rows: number, cols: number, tile: TileTexture = TileTexture.Floor): TileTexture[][] =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => tile));

const buildValidObjects = (mode: GameMode, mapSize: number = SIZE_SMALL): PlacedObject[] => {
    const spawnCount = mapSize === SIZE_SMALL ? SPAWN_SMALL : mapSize === SIZE_MEDIUM ? SPAWN_MEDIUM : SPAWN_LARGE;
    const sanctuaryCount =
        mapSize === SIZE_SMALL ? SANCTUARY_SMALL : mapSize === SIZE_MEDIUM ? SANCTUARY_MEDIUM : SANCTUARY_LARGE;
    const objects: PlacedObject[] = [];
    for (let i = 0; i < spawnCount; i++) {
        objects.push({ type: TileItem.Spawn, position: { x: i, y: 0 } });
    }
    for (let i = 0; i < sanctuaryCount; i++) {
        objects.push({ type: TileItem.HealingSanctuary, position: { x: spawnCount + i, y: 0 } });
        objects.push({ type: TileItem.CombatSanctuary, position: { x: spawnCount + sanctuaryCount + i, y: 0 } });
    }
    if (mode === GameMode.Ctf) {
        objects.push({ type: TileItem.Flag, position: { x: 0, y: mapSize - 1 } });
    }
    return objects;
};

const buildDraft = (overrides: Partial<GameDraftForValidation> = {}): GameDraftForValidation => {
    const mode = overrides.mode ?? GameMode.Classic;
    const size = overrides.size ?? { rows: SIZE_SMALL, cols: SIZE_SMALL };
    return {
        name: 'Test Game',
        description: 'A valid test description',
        mode,
        size,
        grid: buildGrid(size.rows, size.cols),
        placedObjects: buildValidObjects(mode as GameMode, size.rows),
        ...overrides,
    };
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GameValidatorService', () => {
    let service: GameValidatorService;
    let internal: GameValidatorServiceInternal;

    beforeEach(() => {
        service = new GameValidatorService();
        internal = service as unknown as GameValidatorServiceInternal;
    });

    it('should instantiate the service', () => {
        expect(service).toBeTruthy();
    });

    // ── validate() happy path ─────────────────────────────────────────────────

    describe('validate() — happy path', () => {
        /** A perfect small Classic draft yields zero errors. */
        it('should accept a valid small Classic draft', () => {
            const result = service.validate(buildDraft());
            expect(result.isValid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        /** Valid medium and large Classic games are also accepted. */
        [{ size: SIZE_MEDIUM, label: 'medium' }, { size: SIZE_LARGE, label: 'large' }].forEach(({ size, label }) => {
            it(`should accept valid ${label} Classic draft`, () => {
                expect(service.validate(buildDraft({
                    size: { rows: size, cols: size },
                    grid: buildGrid(size, size),
                    placedObjects: buildValidObjects(GameMode.Classic, size),
                })).isValid).toBe(true);
            });
        });

        /** CTF mode requires a flag; a fully-correct CTF draft is accepted. */
        it('should accept a valid small CTF draft', () => {
            expect(service.validate(buildDraft({
                mode: GameMode.Ctf,
                placedObjects: buildValidObjects(GameMode.Ctf, SIZE_SMALL),
            })).isValid).toBe(true);
        });
    });

    // ── validateRequiredFields ────────────────────────────────────────────────

    describe('validateRequiredFields', () => {
        /**
         * Empty string, null, and numeric values fail the non-empty-string guard on mode.
         * Null/non-array values fail for grid and placedObjects.
         * Non-numeric size components are also caught.
         */
        it('should flag empty, null, or non-string mode as missing', () => {
            expect(internal.validateRequiredFields(buildDraft({ mode: '' as GameMode })))
                .toContain('Le mode de jeu est requis !');
            expect(internal.validateRequiredFields(buildDraft({ mode: null as unknown as GameMode })))
                .toContain('Le mode de jeu est requis !');
        });

        it('should flag null or non-array grid as missing', () => {
            expect(internal.validateRequiredFields(buildDraft({ grid: null as unknown as TileTexture[][] })))
                .toContain('La grille du jeu est requise !');
            expect(internal.validateRequiredFields(buildDraft({ grid: {} as unknown as TileTexture[][] })))
                .toContain('La grille du jeu est requise !');
        });

        it('should flag non-numeric size dimensions as invalid', () => {
            expect(internal.validateRequiredFields(
                buildDraft({ size: { rows: 'x' as unknown as number, cols: SIZE_SMALL } }),
            )).toContain('La taille du jeu est invalide !');
            expect(internal.validateRequiredFields(
                buildDraft({ size: { rows: SIZE_SMALL, cols: 'y' as unknown as number } }),
            )).toContain('La taille du jeu est invalide !');
        });

        it('should flag null placedObjects as missing', () => {
            expect(internal.validateRequiredFields(buildDraft({ placedObjects: null as unknown as PlacedObject[] })))
                .toContain('Les objets placés sont requis !');
        });

        it('should return no errors for a fully-formed draft', () => {
            expect(internal.validateRequiredFields(buildDraft())).toEqual([]);
        });
    });

    // ── validateTextLength ────────────────────────────────────────────────────

    describe('validateTextLength', () => {
        /** Empty and whitespace-only names/descriptions are treated as missing. */
        it('should reject empty or whitespace-only name and description', () => {
            expect(internal.validateTextLength('', 'desc')).toContain('Le champ nom est vide !');
            expect(internal.validateTextLength('   ', 'desc')).toContain('Le champ nom est vide !');
            expect(internal.validateTextLength('name', '')).toContain('Le champ description est vide !');
        });

        /** At-max values pass; one-over-max values are rejected. */
        it('should apply max-length boundaries for name and description', () => {
            expect(internal.validateTextLength('a'.repeat(NAME_TOO_LONG - 1), 'desc'))
                .not.toContain('Le champ nom dépasse la longueur maximale !');
            expect(internal.validateTextLength('a'.repeat(NAME_TOO_LONG), 'desc'))
                .toContain('Le champ nom dépasse la longueur maximale !');
            expect(internal.validateTextLength('name', 'b'.repeat(DESC_TOO_LONG)))
                .toContain('Le champ description dépasse la longueur maximale !');
        });

        /** Null values fall through the nullish-coalescing guard to an empty string. */
        it('should treat null name or description as empty', () => {
            expect(internal.validateTextLength(null as unknown as string, 'desc'))
                .toContain('Le champ nom est vide !');
            expect(internal.validateTextLength('name', null as unknown as string))
                .toContain('Le champ description est vide !');
        });

        it('should return no errors when both fields are within bounds', () => {
            expect(internal.validateTextLength('My Game', 'Description')).toEqual([]);
        });
    });

    // ── validateGameMode ──────────────────────────────────────────────────────

    describe('validateGameMode', () => {
        /** Every GameMode enum member must be accepted. */
        it('should accept every member of the GameMode enum', () => {
            for (const mode of Object.values(GameMode)) {
                expect(internal.validateGameMode(mode)).toEqual([]);
            }
        });

        /** Unknown or empty mode strings are rejected with a list of valid modes. */
        it('should reject unknown modes and include valid mode list in error', () => {
            const errors = internal.validateGameMode('invalid');
            expect(errors.some((e) => e.includes('mode de jeu'))).toBe(true);
            expect(errors[0]).toContain(GameMode.Classic);
            expect(errors[0]).toContain(GameMode.Ctf);
            expect(internal.validateGameMode('')).not.toEqual([]);
        });
    });

    // ── validateGridSize ──────────────────────────────────────────────────────

    describe('validateGridSize', () => {
        /** All three accepted grid sizes produce zero errors. */
        [SIZE_SMALL, SIZE_MEDIUM, SIZE_LARGE].forEach((size) => {
            it(`should accept valid ${size}×${size} grid`, () => {
                expect(internal.validateGridSize({ rows: size, cols: size }, buildGrid(size, size))).toEqual([]);
            });
        });

        it('should reject non-square or invalid-enum grid sizes', () => {
            expect(internal.validateGridSize(
                { rows: SIZE_SMALL, cols: SIZE_MEDIUM }, buildGrid(SIZE_SMALL, SIZE_MEDIUM),
            ).some((e) => e.includes('La grille doit être carrée'))).toBe(true);
            
            expect(internal.validateGridSize(
                { rows: SIZE_INVALID, cols: SIZE_INVALID }, buildGrid(SIZE_INVALID, SIZE_INVALID),
            ).some((e) => e.includes('La grille doit être carrée'))).toBe(true);
        });

        /** Zero or negative dimensions, empty grid, and row/col mismatches are also flagged. */
        it('should reject zero/negative dimensions, empty grids, and count mismatches', () => {
            expect(internal.validateGridSize({ rows: 0, cols: 0 }, buildGrid(1, 1)))
                .toContain('Les dimensions de la grille doivent être positives !');
            expect(internal.validateGridSize({ rows: SIZE_SMALL, cols: SIZE_SMALL }, []))
                .toContain('La grille est vide !');

            const colGrid = buildGrid(SIZE_SMALL, SIZE_SMALL);
            colGrid[0] = Array.from({ length: GRID_MISMATCH }, () => TileTexture.Floor);
            expect(internal.validateGridSize({ rows: SIZE_SMALL, cols: SIZE_SMALL }, colGrid))
                .toContain('Le nombre de colonnes de la grille ne correspond pas à la taille spécifiée !');
            expect(internal.validateGridSize(
                { rows: SIZE_SMALL, cols: SIZE_SMALL }, buildGrid(GRID_MISMATCH, SIZE_SMALL),
            )).toContain('Le nombre de lignes de la grille ne correspond pas à la taille spécifiée !');
        });
    });

    // ── validateTileTypes ─────────────────────────────────────────────────────

    describe('validateTileTypes', () => {
        it('should accept valid mixing, reject unknown tiles, and report multiple errors with positions', () => {
            const validGrid = buildGrid(SIZE_SMALL, SIZE_SMALL);
            validGrid[0][0] = TileTexture.Wall; validGrid[0][1] = TileTexture.Water;
            validGrid[1][0] = TileTexture.Ice; validGrid[1][1] = TileTexture.DoorOpened;
            expect(internal.validateTileTypes(validGrid)).toEqual([]);

            const invalidGrid = buildGrid(SIZE_SMALL, SIZE_SMALL);
            invalidGrid[2][4] = 'lava' as TileTexture;
            invalidGrid[1][1] = 'stone' as TileTexture;
            const errors = internal.validateTileTypes(invalidGrid);
            
            expect(errors.filter((e) => e.includes('Type de case invalide')).length).toBe(2);
            expect(errors.some((e) => e.includes('(2, 4)'))).toBe(true);
        });
    });

    // ── validatePlacedObjectTypes ─────────────────────────────────────────────

    describe('validatePlacedObjectTypes', () => {
        it('should accept a list of objects with valid types and positions', () => {
            expect(internal.validatePlacedObjectTypes(buildValidObjects(GameMode.Classic))).toEqual([]);
        });

        /** Unknown types and missing/non-numeric positions are flagged. */
        it('should reject unknown type, non-numeric position, or missing position', () => {
            expect(internal.validatePlacedObjectTypes([{ type: 'invalid' as TileItem, position: { x: 0, y: 0 } }])
                .some((e) => e.includes('objet placé invalide'))).toBe(true);
            expect(internal.validatePlacedObjectTypes([
                { type: TileItem.Spawn, position: { x: 'a' as unknown as number, y: 0 } },
            ]).some((e) => e.includes('position invalide'))).toBe(true);
            expect(internal.validatePlacedObjectTypes([
                { type: TileItem.Spawn, position: null as unknown as { x: number; y: number } },
            ]).some((e) => e.includes('position invalide'))).toBe(true);
        });
    });

    // ── validatePlacedObjectPositions ─────────────────────────────────────────

    describe('validatePlacedObjectPositions', () => {
        const sz = { rows: SIZE_SMALL, cols: SIZE_SMALL };

        it('should accept objects placed inside the grid boundaries', () => {
            expect(internal.validatePlacedObjectPositions(buildValidObjects(GameMode.Classic, SIZE_SMALL), sz)).toEqual([]);
        });

        it('should reject objects outside every boundary', () => {
            const outOfBounds: [number, number][] = [[-1, 0], [SIZE_SMALL, 0], [0, -1], [0, SIZE_SMALL]];
            for (const [x, y] of outOfBounds) {
                const errors = internal.validatePlacedObjectPositions(
                    [{ type: TileItem.Spawn, position: { x, y } }], sz,
                );
                expect(errors.some((e) => e.includes('est hors limites !'))).toBe(true);
            }
        });

        /** Duplicate position triggers the collision error with coordinates. */
        it('should reject duplicate positions and report coordinates', () => {
            const objects: PlacedObject[] = [
                { type: TileItem.Spawn, position: { x: 2, y: 3 } },
                { type: TileItem.Flag, position: { x: 2, y: 3 } },
            ];
            const errors = internal.validatePlacedObjectPositions(objects, sz);
            expect(errors.some((e) => e.includes('Plusieurs objets placés à la même position'))).toBe(true);
            expect(errors.some((e) => e.includes('(3, 2)'))).toBe(true);
        });
    });

    // ── getRequiredObjectCounts ───────────────────────────────────────────────

    describe('getRequiredObjectCounts', () => {
        /** Spawn, sanctuary, and flag counts are correct for every map size and mode. */
        it('should return correct counts for all map sizes in Classic mode', () => {
            const small = internal.getRequiredObjectCounts(SIZE_SMALL, GameMode.Classic);
            expect(small[TileItem.Spawn]).toBe(SPAWN_SMALL);
            expect(small[TileItem.Flag]).toBe(FLAG_CLASSIC);
            expect(small[TileItem.HealingSanctuary]).toBe(SANCTUARY_SMALL);
            expect(internal.getRequiredObjectCounts(SIZE_MEDIUM, GameMode.Classic)[TileItem.Spawn]).toBe(SPAWN_MEDIUM);
            expect(internal.getRequiredObjectCounts(SIZE_LARGE, GameMode.Classic)[TileItem.Spawn]).toBe(SPAWN_LARGE);
        });

        it('should require 1 flag for CTF and 0 for Classic', () => {
            expect(internal.getRequiredObjectCounts(SIZE_SMALL, GameMode.Ctf)[TileItem.Flag]).toBe(FLAG_CTF);
            expect(internal.getRequiredObjectCounts(SIZE_SMALL, GameMode.Classic)[TileItem.Flag]).toBe(FLAG_CLASSIC);
        });

        it('should fallback to Large limit and count sanctuaries correctly', () => {
            expect(internal.getRequiredObjectCounts(SIZE_INVALID_FOR_LARGE, GameMode.Classic)[TileItem.Spawn]).toBe(SPAWN_LARGE);
            expect(internal.getRequiredObjectCounts(SIZE_MEDIUM, GameMode.Classic)[TileItem.HealingSanctuary]).toBe(SANCTUARY_MEDIUM);
            expect(internal.getRequiredObjectCounts(SIZE_LARGE, GameMode.Classic)[TileItem.HealingSanctuary]).toBe(SANCTUARY_LARGE);
        });
    });

    // ── countPlacedObjects ────────────────────────────────────────────────────

    describe('countPlacedObjects', () => {
        it('should count each TileItem type and handle empty or unknown types', () => {
            const countsEmpty = internal.countPlacedObjects([]);
            expect(countsEmpty[TileItem.Spawn]).toBe(0);

            const objects: PlacedObject[] = [
                { type: TileItem.Spawn, position: { x: 0, y: 0 } },
                { type: TileItem.Flag, position: { x: 1, y: 0 } },
                { type: TileItem.CombatSanctuary, position: { x: 3, y: 0 } },
                { type: 'unknown' as TileItem, position: { x: 4, y: 0 } },
            ];
            const counts = internal.countPlacedObjects(objects);
            expect(counts[TileItem.Spawn]).toBe(1);
            expect(counts[TileItem.Flag]).toBe(1);
            expect(counts[TileItem.CombatSanctuary]).toBe(1);
            expect(counts['unknown' as TileItem]).toBeUndefined();
        });
    });

    // ── validateRequiredObjectCounts ──────────────────────────────────────────

    describe('validateRequiredObjectCounts', () => {
        it('should report all missing item types for an empty placedObjects list', () => {
            const errors = internal.validateRequiredObjectCounts(buildDraft({ placedObjects: [] }));
            expect(errors.some((e) => e.includes('spawn point'))).toBe(true);
            expect(errors.some((e) => e.includes('healing sanctuary'))).toBe(true);
        });

        it('should flag missing flag for CTF and not require one for Classic', () => {
            const ctf = internal.validateRequiredObjectCounts(buildDraft({
                mode: GameMode.Ctf,
                placedObjects: buildValidObjects(GameMode.Classic),
            }));
            const classic = internal.validateRequiredObjectCounts(buildDraft({
                mode: GameMode.Classic,
                placedObjects: buildValidObjects(GameMode.Classic),
            }));
            expect(ctf.some((e) => e.includes('On attend 1') && e.includes('flag'))).toBe(true);
            expect(classic.some((e) => e.includes('flag'))).toBe(false);
        });

        it('should produce no count errors for a fully-valid draft', () => {
            expect(internal.validateRequiredObjectCounts(buildDraft())).toEqual([]);
        });
    });

    // ── getItemName ───────────────────────────────────────────────────────────

    describe('getItemName', () => {
        it('should return correct human-readable labels for all TileItem types and fallback for unknown', () => {
            expect(internal.getItemName(TileItem.Spawn)).toBe('spawn point');
            expect(internal.getItemName(TileItem.Flag)).toBe('flag');
            expect(internal.getItemName(TileItem.HealingSanctuary)).toBe('healing sanctuary');
            expect(internal.getItemName(TileItem.CombatSanctuary)).toBe('combat sanctuary');
            expect(internal.getItemName('unknown' as TileItem)).toBe('item');
        });
    });

    // ── validate() full integration ───────────────────────────────────────────

    describe('validate() — full integration', () => {
        /**
         * Multiple simultaneous field violations accumulate without short-circuiting.
         * isValid is strictly correlated to the errors array.
         */
        it('should accumulate multiple errors and correlate isValid correctly', () => {
            const result = service.validate(buildDraft({ name: '', description: '', placedObjects: [] }));
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);

            const valid = service.validate(buildDraft());
            expect(valid.isValid).toBe(true);
            expect(valid.errors.length === 0).toBe(valid.isValid);
        });

        /** Invalid mode, invalid tile, missing CTF flag, and out-of-bounds object each fail. */
        it('should reject drafts with mode error, invalid tile, missing flag, or OOB object', () => {
            expect(service.validate(buildDraft({ mode: 'battle-royale' as GameMode })).isValid).toBe(false);

            const badGrid = buildGrid(SIZE_SMALL, SIZE_SMALL);
            badGrid[1][2] = 'magma' as TileTexture;
            expect(service.validate(buildDraft({ grid: badGrid })).isValid).toBe(false);

            expect(service.validate(buildDraft({
                mode: GameMode.Ctf,
                placedObjects: buildValidObjects(GameMode.Classic),
            })).isValid).toBe(false);

            const oob = buildValidObjects(GameMode.Classic);
            oob[0] = { type: TileItem.Spawn, position: { x: SIZE_SMALL, y: SIZE_SMALL } };
            expect(service.validate(buildDraft({ placedObjects: oob })).isValid).toBe(false);
        });

        /** A valid medium CTF draft with all required objects passes. */
        it('should accept a valid medium CTF draft', () => {
            expect(service.validate(buildDraft({
                mode: GameMode.Ctf,
                size: { rows: SIZE_MEDIUM, cols: SIZE_MEDIUM },
                grid: buildGrid(SIZE_MEDIUM, SIZE_MEDIUM),
                placedObjects: buildValidObjects(GameMode.Ctf, SIZE_MEDIUM),
            })).isValid).toBe(true);
        });
    });
});