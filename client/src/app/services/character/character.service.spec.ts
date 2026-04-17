/**
 * Testing:
 * - Character creation with different stat bonuses
 * - Random character generation
 * - Name and avatar validation
 */

import { TestBed } from '@angular/core/testing';
import { AVATARS_PATH, BASE_STATS } from '@common/constants/character.constants';
import { CharacterService } from './character.service';

describe('CharacterService', () => {
    let service: CharacterService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(CharacterService);
    });

    it('should create the service', () => {
        expect(service).toBeTruthy();
    });

    // Test character creation with life bonus
    it('should create character with life bonus and D6 attack dice', () => {
        const character = service.createCharacter('Hero', AVATARS_PATH[0], true, true);

        expect(character.name).toBe('Hero');
        expect(character.avatar).toBe(AVATARS_PATH[0]);
        expect(character.life).toBe(BASE_STATS.life + BASE_STATS.bonus);
        expect(character.speed).toBe(BASE_STATS.speed);
        expect(character.attack).toBe(BASE_STATS.attack);
        expect(character.defense).toBe(BASE_STATS.defense);
        expect(character.lifeBonus).toBe(true);
        expect(character.attackDice).toBe('D6');
        expect(character.defenseDice).toBe('D4');
    });

    // Test character creation with speed bonus
    it('should create character with speed bonus and D4 attack dice', () => {
        const character = service.createCharacter('Speedy', AVATARS_PATH[1], false, false);

        expect(character.name).toBe('Speedy');
        expect(character.avatar).toBe(AVATARS_PATH[1]);
        expect(character.life).toBe(BASE_STATS.life);
        expect(character.speed).toBe(BASE_STATS.speed + BASE_STATS.bonus);
        expect(character.lifeBonus).toBe(false);
        expect(character.attackDice).toBe('D4');
        expect(character.defenseDice).toBe('D6');
    });

    // Test character creation removed whitespace from name
    it('should trim whitespace from character name', () => {
        const character = service.createCharacter('  Test  ', AVATARS_PATH[0], true, true);

        expect(character.name).toBe('Test');
    });

    // Test all avatar indices
    it('should create character with each avatar index', () => {
        for (const avatarPath of AVATARS_PATH) {
            const character = service.createCharacter('Test', avatarPath, true, true);
            expect(character.avatar).toBe(avatarPath);
        }
    });

    // Test random character generation returns valid data
    it('should generate random character with valid properties', () => {
        const random = service.generateRandomCharacter();

        expect(random.name).toBeTruthy();
        expect(random.name.length).toBeGreaterThan(0);
        expect(random.avatarPath).toBeTruthy();
        expect(AVATARS_PATH).toContain(random.avatarPath);
        expect(typeof random.lifeBonus).toBe('boolean');
        expect(typeof random.attackDiceD6).toBe('boolean');
    });

    it('should generate avatar from provided avatar pool', () => {
        const limitedPool = [AVATARS_PATH[0], AVATARS_PATH[1]];

        const random = service.generateRandomCharacter(limitedPool);

        expect(limitedPool).toContain(random.avatarPath);
    });

    it('should fallback to default avatars when provided pool is empty', () => {
        const random = service.generateRandomCharacter([]);

        expect(AVATARS_PATH).toContain(random.avatarPath);
    });

    // Test random character generation produces different results
    it('should generate different random characters on multiple calls', () => {
        const random1 = service.generateRandomCharacter();
        const random2 = service.generateRandomCharacter();
        const random3 = service.generateRandomCharacter();

        const allSame =
            random1.name === random2.name && random2.name === random3.name &&
            random1.avatarPath === random2.avatarPath && random2.avatarPath === random3.avatarPath &&
            random1.lifeBonus === random2.lifeBonus && random2.lifeBonus === random3.lifeBonus &&
            random1.attackDiceD6 === random2.attackDiceD6 && random2.attackDiceD6 === random3.attackDiceD6;

        expect(allSame).toBe(false);
    });

    // Test name validation accepts valid names
    it('should validate non-empty names as valid', () => {
        expect(service.isValidName('Valid Name')).toBe(true);
        expect(service.isValidName('A')).toBe(true);
        expect(service.isValidName('   Trimmed   ')).toBe(true);
    });

    // Empty or whitespace-only names
    it('should reject empty or whitespace-only names', () => {
        expect(service.isValidName('')).toBe(false);
        expect(service.isValidName('   ')).toBe(false);
        expect(service.isValidName('\t\n')).toBe(false);
    });

    // Test avatar validation accepts valid indices
    it('should validate avatar indices within range', () => {
        expect(service['isValidAvatar'](0)).toBe(true);
        expect(service['isValidAvatar'](AVATARS_PATH.length - 1)).toBe(true);

        const middleIndex = Math.floor(AVATARS_PATH.length / 2);
        expect(service['isValidAvatar'](middleIndex)).toBe(true);
    });

    // Invalid avatar indices
    it('should reject null or out-of-range avatar indices', () => {
        expect(service['isValidAvatar'](null as unknown as number)).toBe(false);
        expect(service['isValidAvatar'](-1)).toBe(false);
        expect(service['isValidAvatar'](AVATARS_PATH.length)).toBe(false);
        expect(service['isValidAvatar'](AVATARS_PATH.length + 1)).toBe(false);
        expect(service['isValidAvatar'](NaN)).toBe(false);
    });
});
