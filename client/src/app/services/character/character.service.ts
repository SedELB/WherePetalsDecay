import { Injectable } from '@angular/core';
import { AVATARS_PATH, BASE_STATS, Character, RANDOM_NAMES, RANDOM_PROBABILITY } from '@common/character';

@Injectable({
    providedIn: 'root',
})
export class CharacterService {
    createCharacter(name: string, avatarIndex: number, lifeBonus: boolean, attackDiceD6: boolean): Character {
        const life = BASE_STATS.life + (lifeBonus ? BASE_STATS.bonus : 0);
        const speed = BASE_STATS.speed + (!lifeBonus ? BASE_STATS.bonus : 0);

        return {
            name: name.trim(),
            avatar: AVATARS_PATH[avatarIndex],
            life,
            speed,
            attack: BASE_STATS.attack,
            defense: BASE_STATS.defense,
            lifeBonus,
            attackDice: attackDiceD6 ? 'D6' : 'D4',
            defenseDice: attackDiceD6 ? 'D4' : 'D6',
        };
    }

    generateRandomCharacter(): { name: string; avatarIndex: number; lifeBonus: boolean; attackDiceD6: boolean } {
        const randomNameIndex: number = Math.floor(Math.random() * RANDOM_NAMES.length);
        const avatarIndex: number = Math.floor(Math.random() * AVATARS_PATH.length);
        const lifeBonus: boolean = Math.random() < RANDOM_PROBABILITY;
        const attackDiceD6: boolean = Math.random() < RANDOM_PROBABILITY;

        return {
            name: RANDOM_NAMES[randomNameIndex],
            avatarIndex,
            lifeBonus,
            attackDiceD6,
        };
    }

    isValidName(name: string): boolean {
        return name.trim().length > 0;
    }

    isValidAvatar(index: number | null): boolean {
        return index !== null && index >= 0 && index < AVATARS_PATH.length;
    }
}