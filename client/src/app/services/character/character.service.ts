import { Injectable } from '@angular/core';
import { Character } from '@common/character';
import { AVATARS_PATH, BASE_STATS, RANDOM_NAMES, RANDOM_PROBABILITY } from '@common/constants/character.constants';

@Injectable({
    providedIn: 'root',
})
export class CharacterService {
    createCharacter(name: string, avatarPath: string, lifeBonus: boolean, attackDiceD6: boolean): Character {
        const life = BASE_STATS.life + (lifeBonus ? BASE_STATS.bonus : 0);
        const speed = BASE_STATS.speed + (!lifeBonus ? BASE_STATS.bonus : 0);

        return {
            name: name.trim(),
            avatar: avatarPath,
            life,
            speed,
            attack: BASE_STATS.attack,
            defense: BASE_STATS.defense,
            lifeBonus,
            attackDice: attackDiceD6 ? 'D6' : 'D4',
            defenseDice: attackDiceD6 ? 'D4' : 'D6',
        };
    }

    generateRandomCharacter(): { name: string; avatarPath: string; lifeBonus: boolean; attackDiceD6: boolean } {
        const randomAvatarIndex: number = Math.floor(Math.random() * AVATARS_PATH.length);
        const randomNameIndex: number = Math.floor(Math.random() * RANDOM_NAMES.length);
        const randomAvatar: string = AVATARS_PATH[randomAvatarIndex];
        const lifeBonus: boolean = Math.random() < RANDOM_PROBABILITY;
        const attackDiceD6: boolean = Math.random() < RANDOM_PROBABILITY;

        return {
            name: RANDOM_NAMES[randomNameIndex],
            avatarPath: randomAvatar,
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
