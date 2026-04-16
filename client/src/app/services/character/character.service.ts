import { Injectable } from '@angular/core';
import { RandomCharacter } from '@app/interfaces/page.interfaces';
import { Character } from '@common/character';
import { AVATARS_PATH, BASE_STATS, RANDOM_NAMES, RANDOM_PROBABILITY } from '@common/constants/character.constants';
import { DiceType } from '@common/enums';

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
            attackDice: attackDiceD6 ? DiceType.D6 : DiceType.D4,
            defenseDice: attackDiceD6 ? DiceType.D4 : DiceType.D6,
        };
    }

    generateRandomCharacter(avatarPool: readonly string[] = AVATARS_PATH): RandomCharacter {
        const validAvatarPool = avatarPool.length > 0 ? avatarPool : AVATARS_PATH;
        const lifeBonus: boolean = Math.random() < RANDOM_PROBABILITY;
        const attackDiceD6: boolean = Math.random() < RANDOM_PROBABILITY;

        return {
            name: this.getRandomItem(RANDOM_NAMES),
            avatarPath: this.getRandomItem(validAvatarPool),
            lifeBonus,
            attackDiceD6,
        };
    }

    private getRandomItem<T>(items: readonly T[]): T {
        const randomIndex = Math.floor(Math.random() * items.length);
        return items[randomIndex];
    }

    isValidName(name: string): boolean {
        return name.trim().length > 0;
    }

    isValidAvatar(index: number | null): boolean {
        return index !== null && index >= 0 && index < AVATARS_PATH.length;
    }
}
