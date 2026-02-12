import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ROUTES } from '@app/constants/routes.constants';
import { AVATARS_PATH, BASE_STATS } from '@app/interfaces/character';
import { Game } from '@app/interfaces/game';
import { CharacterService } from '@app/services/character/character.service';
import { NAME_MAX_LENGTH } from '@app/services/game-validator/game-validator.service';
import { PlayerGameService } from '@app/services/player-game/player-game.service';
import { Subscription } from 'rxjs';

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

export class GameCreationComponent implements OnInit, OnDestroy {
    currentPhase: 'game-selection' | 'character-creation' = 'game-selection';
    selectedGame: Game | null = null;
    characterName: string = '';
    selectedAvatarIndex: number | null = null;
    lifeBonusSelected: boolean = true;
    attackDiceD6: boolean = true;

    nameMaxLength = NAME_MAX_LENGTH;
    games: Game[] = [];
    private gamesSubscription: Subscription | null = null;

    readonly avatars = AVATARS_PATH;
    readonly baseStats = BASE_STATS;
    readonly routes = ROUTES;

    constructor(
        private readonly router: Router,
        private readonly characterService: CharacterService,
        private readonly playerGameService: PlayerGameService,
    ) {}

    private formatErrorMessage(error: HttpErrorResponse, fallbackMessage: string): string {
        if (!error.error) {
            return fallbackMessage;
        }

        if (Array.isArray(error.error)) {
            return error.error.join('\n');
        }

        if (typeof error.error === 'string') {
            return error.error;
        }

        if (error.error.message) {
            return error.error.message;
        }

        return fallbackMessage;
    }

    ngOnInit(): void {
        this.playerGameService.fetchVisibleGames().subscribe({
            next: (games) => this.playerGameService.setGames(games),
            error: (error: HttpErrorResponse) => {
                const errorMessage = this.formatErrorMessage(error, 'Erreur lors de la récupération des jeux');
                alert(`Erreur:\n${errorMessage}`);
            },
        });

        this.gamesSubscription = this.playerGameService.visibleGames$.subscribe((games) => {
            this.games = games.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateA.getTime() - dateB.getTime();
            });

            if (this.selectedGame && !games.find((g) => g._id === this.selectedGame?._id)) {
                this.handleGameNoLongerAvailable();
            }
        });
    }

    ngOnDestroy(): void {
        this.gamesSubscription?.unsubscribe();
    }

    handleGameNoLongerAvailable(): void {
        alert('Le jeu sélectionné n\'est plus disponible.');
        this.goBackToGameSelection();
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

    selectGame(game: Game): void {
        this.selectedGame = game;
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

    getGameSizeLabel(game: Game): { rows: number, cols: number } {
        return game.size;
    }
}