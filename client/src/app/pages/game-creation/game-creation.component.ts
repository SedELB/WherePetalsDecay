import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ListContainerComponent } from '@app/components/list-container/list-container.component';
import { BASE_STATS, AVATARS, RANDOM_NAMES } from '@app/interfaces/character';

@Component({
    selector: 'app-game-creation',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonComponent,
        GameCardComponent,
        ListContainerComponent,
    ],
    templateUrl: './game-creation.component.html',
    styleUrls: ['./game-creation.component.scss'],
})
export class GameCreationComponent {
    currentPhase: 'game-selection' | 'character-creation' = 'game-selection';
    selectedGame: string | null = null;
    characterName: string = '';
    selectedAvatarIndex: number | null = null;
    lifeBonusSelected: boolean = true;
    attackDiceD6: boolean = true;

    readonly avatars = AVATARS;
    readonly baseStats = BASE_STATS;
    readonly randomNames = RANDOM_NAMES;
    readonly avatarCount = 12;

    constructor(private router: Router) {}

    get lifeValue(): number {
        return this.baseStats.life + (this.lifeBonusSelected ? this.baseStats.bonus : 0);
    }

    get speedValue(): number {
        return this.baseStats.speed + (!this.lifeBonusSelected ? this.baseStats.bonus : 0);
    }

    get attackValue(): number {
        return this.baseStats.attack;
    }

    get defenseValue(): number {
        return this.baseStats.defense;
    }

    get attackDice(): string {
        return this.attackDiceD6 ? 'D6' : 'D4';
    }

    get defenseDice(): string {
        return this.attackDiceD6 ? 'D4' : 'D6';
    }

    selectGame(gameName: string): void {
        this.selectedGame = gameName;
        this.currentPhase = 'character-creation';
    }

    selectAvatar(index: number): void {
        this.selectedAvatarIndex = index;
    }

    selectBonus(isLifeBonus: boolean): void {
        this.lifeBonusSelected = isLifeBonus;
    }

    selectAttackDice(isD6: boolean): void {
        this.attackDiceD6 = isD6;
    }

    goBackToGameSelection(): void {
        this.currentPhase = 'game-selection';
        this.selectedGame = null;
        this.resetCharacterForm();
    }

    resetCharacterForm(): void {
        this.characterName = '';
        this.selectedAvatarIndex = null;
        this.lifeBonusSelected = true;
        this.attackDiceD6 = true;
    }

    generateRandomCharacter(): void {
        const randomNameIndex = Math.floor(Math.random() * this.randomNames.length);
        this.characterName = this.randomNames[randomNameIndex];

        this.selectedAvatarIndex = Math.floor(Math.random() * this.avatarCount);

        this.lifeBonusSelected = Math.random() < 0.5;

        this.attackDiceD6 = Math.random() < 0.5;
    }

    isFormValid(): boolean {
        return this.characterName.trim().length > 0 && this.selectedAvatarIndex !== null;
    }

    confirmCharacter(): void {
        if (this.isFormValid()) {
            const character = {
                name: this.characterName,
                avatar: this.avatars[this.selectedAvatarIndex!],
                life: this.lifeValue,
                speed: this.speedValue,
                attack: this.attackValue,
                defense: this.defenseValue,
                attackDice: this.attackDice,
                defenseDice: this.defenseDice,
            };
            console.log('Personnage créé:', character);
            this.router.navigate(['/waiting-room']);
        }
    }
}