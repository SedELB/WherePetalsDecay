import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ROUTES } from '@app/constants/routes.constants';
import { AVATARS_PATH, BASE_STATS } from '@common/character';
import { Game } from '@common/game';
import { CharacterService } from '@app/services/character/character.service';
import { PlayerGameService } from '@app/services/game-creation/game-creation.service';
import { NAME_MAX_LENGTH } from '@app/services/game-validator/game-validator.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { Subscription } from 'rxjs';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';

// The page after clicking "Creer une partie"
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
    isSubmitting = false;

    nameMaxLength = NAME_MAX_LENGTH;
    games: Game[] = [];
    private gamesSubscription: Subscription | null = null;
    readonly avatars = AVATARS_PATH;
    readonly baseStats = BASE_STATS;
    readonly routes = ROUTES;

    webSocketService = inject(WebSocketService);

    constructor(
        private readonly router: Router,
        private readonly characterService: CharacterService,
        private readonly playerGameService: PlayerGameService,
    ) {}

    ngOnInit(): void {
        this.playerGameService.fetchVisibleGames().subscribe({
            next: (games) => this.playerGameService.setGames(games),
            error: (error: HttpErrorResponse) => {
                const errorMessage = error.error || 'Erreur lors de la récupération des jeux';
                alert(`Erreur: ${errorMessage}`);
            },
        });

        this.gamesSubscription = this.playerGameService.visibleGames$.subscribe((games) => {
            this.games = games.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateA.getTime() - dateB.getTime();
            });
        });

        this.setupNavigationListener();
    }

    ngOnDestroy(): void {
        this.gamesSubscription?.unsubscribe();
        this.webSocketService.off(SocketNamespace.Join, JoinGameEvents.GameHosted);
        this.webSocketService.off(SocketNamespace.Join, JoinGameEvents.LobbyError);
    }

    private setupNavigationListener(): void {
        this.webSocketService.onNamespace<void>(
            SocketNamespace.Join,
            JoinGameEvents.GameHosted,
            () => {
                this.isSubmitting = false;
                this.router.navigate([this.routes.waitingRoom]);
            });

        this.webSocketService.onNamespace<string>(
            SocketNamespace.Join,
            JoinGameEvents.LobbyError,
            (errorMessage) => {
                this.isSubmitting = false;
                alert(`Erreur: ${errorMessage}`);
            },
        );
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
        if (!this.isFormValid() || this.selectedAvatarIndex === null || !this.selectedGame) {
            return;
        }

        this.isSubmitting = true;

        const character = this.characterService.createCharacter(
            this.characterName,
            this.selectedAvatarIndex,
            this.lifeBonusSelected,
            this.attackDiceD6,
        );

        const payload = {
            game: this.selectedGame,
            player: {
                character,
            },
        };

        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.CreateLobby, payload);
    }

    getGameSizeLabel(game: Game): { rows: number, cols: number } {
        return game.size;
    }
}