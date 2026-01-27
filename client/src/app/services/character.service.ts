import { Injectable } from '@angular/core';
import { AVATARS, BASE_STATS, Character, RANDOM_NAMES, RANDOM_PROBABILITY } from '@app/interfaces/character';

@Injectable({
    providedIn: 'root',
})
export class CharacterService {
    createCharacter(name: string, avatarIndex: number, lifeBonus: boolean, attackDiceD6: boolean): Character {
        const life = BASE_STATS.life + (lifeBonus ? BASE_STATS.bonus : 0);
        const speed = BASE_STATS.speed + (!lifeBonus ? BASE_STATS.bonus : 0);

        return {
            name: name.trim(),
            avatar: AVATARS[avatarIndex],
            life,
            speed,
            attack: BASE_STATS.attack,
            defense: BASE_STATS.defense,
            lifeBonus,
            attackDice: attackDiceD6 ? 'D6' : 'D4',
            defenseDice: attackDiceD6 ? 'D4' : 'D6',
        };
    }

    generateRandomCharacter() {
        const randomNameIndex = Math.floor(Math.random() * RANDOM_NAMES.length);
        const avatarIndex = Math.floor(Math.random() * AVATARS.length);
        const lifeBonus = Math.random() < RANDOM_PROBABILITY;
        const attackDiceD6 = Math.random() < RANDOM_PROBABILITY;

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
        return index !== null && index >= 0 && index < AVATARS.length;
    }
}
