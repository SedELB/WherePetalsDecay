import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { AVAILABLE_GAMES } from '@app/constants/games.constants';
import { ROUTES } from '@app/constants/routes.constants';
import { AVATARS, BASE_STATS } from '@app/interfaces/character';
import { Game } from '@app/interfaces/game';
import { CharacterService } from '@app/services/character.service';
import { CommunicationService } from '@app/services/communication.service';

@Component({
    selector: 'app-game-creation',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonComponent,
        GameCardComponent,
    ],
    templateUrl: './game-creation.component.html',
    styleUrls: ['./game-creation.component.scss'],
})

export class GameCreationComponent implements OnInit {

    currentPhase: 'game-selection' | 'character-creation' = 'game-selection';
    selectedGame: string | null = null;
    characterName: string = '';
    selectedAvatarIndex: number | null = null;
    lifeBonusSelected: boolean = true;
    attackDiceD6: boolean = true;

    readonly avatars = AVATARS;
    readonly baseStats = BASE_STATS;
    readonly availableGames = AVAILABLE_GAMES;
    readonly routes = ROUTES;

    constructor(private readonly router: Router, private readonly characterService: CharacterService,
                private communicationService: CommunicationService) {}

    games: Game[] = [];

    ngOnInit(): void {
        return;
    }

    getGames(){
        this.communicationService.getVisibleGames().subscribe({
            next: (games) => { 
                    this.games = games;
                    console.log(games);
                },
            error: (err) => {
                console.error('Erreur avec la recherche des jeux visibles : ', err);
            },
        });
    }

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
        const random = this.characterService.generateRandomCharacter();
        this.characterName = random.name;
        this.selectedAvatarIndex = random.avatarIndex;
        this.lifeBonusSelected = random.lifeBonus;
        this.attackDiceD6 = random.attackDiceD6;
    }

    isFormValid(): boolean {
        return (
            this.characterService.isValidName(this.characterName) &&
            this.characterService.isValidAvatar(this.selectedAvatarIndex)
        );
    }

    confirmCharacter(): void {
        if (!this.isFormValid() || this.selectedAvatarIndex === null) {
            return;
        }

        this.characterService.createCharacter(
            this.characterName,
            this.selectedAvatarIndex,
            this.lifeBonusSelected,
            this.attackDiceD6,
        );

        this.router.navigate([this.routes.waitingRoom]);
    }
}