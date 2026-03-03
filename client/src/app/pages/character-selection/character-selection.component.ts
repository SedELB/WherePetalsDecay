import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ROUTES } from '@app/constants/routes.constants';
import { CharacterService } from '@app/services/character/character.service';
import { NAME_MAX_LENGTH } from '@app/services/game-validator/game-validator.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { AVATARS_PATH, BASE_STATS } from '@common/character';
import { SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';

@Component({
  selector: 'app-character-selection',
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './character-selection.component.html',
  styleUrl: './character-selection.component.scss',
})
export class CharacterSelectionComponent implements OnInit, OnDestroy {
    characterName: string = '';
    selectedAvatarIndex: number | null = null;
    lifeBonusSelected: boolean = true;
    attackDiceD6: boolean = true;
    isSubmitting = false;

    nameMaxLength = NAME_MAX_LENGTH;
    gameId: string | null = null; 
    selectedGame: Game | null = null;
    
    // Constantes (Imports)
    readonly avatars = AVATARS_PATH;
    readonly baseStats = BASE_STATS;
    readonly routes = ROUTES;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private characterService: CharacterService,
        private webSocketService: WebSocketService,
    ) {}

    ngOnInit(): void {
      // Get gameID from the URL parameter.
      this.gameId = this.route.snapshot.paramMap.get('gameId');

      // Get game object from History (in router after redirection from selecting a game).
      const state = history.state;
      if (state && state.game){
        this.selectedGame = state.game;
      }

      this.setupNavigationListener();
    }

    
    get lifeValue(): number { 
      return this.baseStats.life + (this.lifeBonusSelected ? this.baseStats.bonus : 0);
    }

    get speedValue(): number {
       return this.baseStats.speed + (!this.lifeBonusSelected ? this.baseStats.bonus : 0); 
    }

    get attackDice(): string {
       return this.attackDiceD6 ? 'D6' : 'D4'; 
    
    }

    get defenseDice(): string {
       return this.attackDiceD6 ? 'D4' : 'D6'; 
    }

    get attackValue(): number {
        return this.baseStats.attack;
    }

    get defenseValue(): number {
        return this.baseStats.defense;
    }

    isFormValid(): boolean {
        return (
            this.characterService.isValidName(this.characterName) &&
            this.characterService.isValidAvatar(this.selectedAvatarIndex)
        );
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

    confirmCharacter(): void {
        if (!this.isFormValid() || this.selectedAvatarIndex === null) return;

        this.isSubmitting = true;
        const character = this.characterService.createCharacter(
            this.characterName,
            this.selectedAvatarIndex,
            this.lifeBonusSelected,
            this.attackDiceD6,
        );

        if (this.gameId) {
            // Joining an existing lobby
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.JoinLobby, {
                gameId: this.gameId,
                player: { character },
            });
        } else if (this.selectedGame) {
            // Creating a lobby as host
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.CreateLobby, {
                game: this.selectedGame,
                player: { character },
            });
        }
    }

    private setupNavigationListener(): void {
        this.webSocketService.onNamespace<void>(SocketNamespace.Join, JoinGameEvents.GameHosted, () => {
            this.router.navigate([this.routes.waitingRoom]);
        });
        
        this.webSocketService.onNamespace<void>(SocketNamespace.Join, JoinGameEvents.PlayerJoined, () => {
            this.router.navigate([this.routes.waitingRoom]);
        });
    }

    generateRandomCharacter(): void {
        const random = this.characterService.generateRandomCharacter();
        this.characterName = random.name;
        this.selectedAvatarIndex = random.avatarIndex;
        this.lifeBonusSelected = random.lifeBonus;
        this.attackDiceD6 = random.attackDiceD6;
    }

    goBack(): void {
        if (this.gameId) {
            this.router.navigate([this.routes.joinGame]);
        } else {
            this.router.navigate([this.routes.create]);
        }
    }

    ngOnDestroy(): void {
        this.webSocketService.off(SocketNamespace.Join, JoinGameEvents.GameHosted);
        this.webSocketService.off(SocketNamespace.Join, JoinGameEvents.PlayerJoined);
    }
}
