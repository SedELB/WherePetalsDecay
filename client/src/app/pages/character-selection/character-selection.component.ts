import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { ROUTES } from '@app/constants/routes.constants';
import { CharacterService } from '@app/services/character/character.service';
import { NAME_MAX_LENGTH } from '@app/services/game-validator/game-validator.service';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { AVATARS_PATH, BASE_STATS } from '@common/constants/character.constants';
import { ButtonVariant, SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import swal from 'sweetalert2';
const SMALL_DELAY = 100;
const TOAST_DELAY = 4000;

@Component({
    selector: 'app-character-selection',
    imports: [CommonModule, FormsModule, ButtonComponent],
    templateUrl: './character-selection.component.html',
    styleUrl: './character-selection.component.scss',
})
export class CharacterSelectionComponent implements OnInit, OnDestroy {
    protected readonly buttonVariant = ButtonVariant;
    characterName: string = '';
    selectedAvatar: string | null = null;
    lifeBonusSelected: boolean = true;
    attackDiceD6: boolean = true;
    isSubmitting = false;
    private previousLockState = false;

    nameMaxLength = NAME_MAX_LENGTH;
    lobbyId: string | null = null;
    selectedGame: Game | null = null;
    currentlySelectedAvatars: string[] = [];

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
        // Get gameID from the URL parameter. (Join an existing lobby)
        this.lobbyId = this.route.snapshot.paramMap.get('lobbyId');

        // Get game object from History (Host a new lobby).
        const state = history.state;
        if (state && state.game) {
            this.selectedGame = state.game;
        }

        if (!this.lobbyId && !this.selectedGame) {
            this.router.navigate([this.routes.home]);
            return;
        }

        if (this.lobbyId) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.JoinAvatarRoom, this.lobbyId);
        }

        this.setupNavigationListener();
        this.setupUpdatesListener();
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
            this.selectedAvatar !== null
        );
    }


    selectAvatar(avatar: string): void {
        if (this.currentlySelectedAvatars.includes(avatar) && this.selectedAvatar !== avatar) return;

        // if user clicks the already selected avatar, deselect it
        if (this.selectedAvatar === avatar) {
            this.selectedAvatar = null;
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.SelectAvatar, {
                lobbyId: this.lobbyId,
                avatar: null,
            });
            return;
        }

        this.selectedAvatar = avatar;

        const payload = {
            lobbyId: this.lobbyId,
            avatar: this.selectedAvatar,
        };

        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.SelectAvatar, payload);
    }

    selectBonus(isLifeBonus: boolean): void {
        this.lifeBonusSelected = isLifeBonus;
    }

    selectAttackDice(isD6: boolean): void {
        this.attackDiceD6 = isD6;
    }

    confirmCharacter(): void {
        if (!this.isFormValid() || this.selectedAvatar === null) return;

        this.isSubmitting = true;
        const character = this.characterService.createCharacter(
            this.characterName,
            this.selectedAvatar,
            this.lifeBonusSelected,
            this.attackDiceD6,
        );

        if (this.lobbyId) {
            // Joining an existing lobby
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.JoinLobby, {
                lobbyId: this.lobbyId,
                player: { character },
            });

        } else if (this.selectedGame) {
            // Creating a lobby as host (a host lobbyId will be null since his URL in character-selection will not contain a pre-exising lobbyId)
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.CreateLobby, {
                game: this.selectedGame,
                player: { character },
            });
        }
    }

    private setupNavigationListener(): void {
        const navigateToLobby = (lobbyData: Lobby) => {
            this.router.navigate([this.routes.waitingRoom, lobbyData.lobbyId], {
                state: { lobby: lobbyData },
            });
        };

        this.webSocketService.onNamespace(SocketNamespace.Join, JoinGameEvents.GameHosted, navigateToLobby);
        this.webSocketService.onNamespace(SocketNamespace.Join, JoinGameEvents.LobbyJoined, navigateToLobby);
    }

    private setupUpdatesListener(): void {
        this.webSocketService.onNamespace<string[]>(SocketNamespace.Join, JoinGameEvents.UpdateOccupiedAvatars, (occupiedAvatars) => {
            this.currentlySelectedAvatars = occupiedAvatars;
        });

        this.webSocketService.onNamespace<Lobby>(SocketNamespace.Join, JoinGameEvents.LobbyUpdated, (lobby) => {
            if (lobby.isLocked === this.previousLockState) return;
            this.previousLockState = lobby.isLocked;

            const message = lobby.isLocked
                ? 'La partie a été verrouillée par l\'organisateur'
                : 'La partie a été déverrouillée';
            swal.fire({
                title: lobby.isLocked ? 'Partie verrouillée' : 'Partie déverrouillée',
                text: message,
                icon: lobby.isLocked ? 'warning' : 'info',
                toast: true,
                position: 'top-end',
                timer: TOAST_DELAY,
                timerProgressBar: true,
                showConfirmButton: false,
            });
        });

        this.webSocketService.onNamespace<void>(SocketNamespace.Join, JoinGameEvents.GameDeleted, () => {
            swal.fire({
                title: 'Partie annulée',
                text: "L'organisateur a annulé la partie.",
                icon: 'info',
                confirmButtonText: "Retourner à l'accueil",
                showCancelButton: false,
            }).then(() => {
                this.router.navigate([this.routes.home]);
            });
        });

        this.webSocketService.onNamespace(SocketNamespace.Join, JoinGameEvents.LobbyError, (message) => {
            swal.fire({
                title: `Erreur`,
                text: `${message}`,
                icon: 'error',
                confirmButtonText: `Retourner à l'accueil`,
                showCancelButton: true,
                cancelButtonText: `Réessayer`,
            }).then((result) => {
                if (result.isConfirmed) {
                    if (this.lobbyId) {
                        this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.SelectAvatar, {
                            lobbyId: this.lobbyId,
                            avatar: null,
                        });
                    }
                    this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
                    setTimeout(() => {
                        this.router.navigate([this.routes.home]);
                    }, SMALL_DELAY);
                } else {
                    this.isSubmitting = false;
                }
            });
        });
    }

    generateRandomCharacter(): void {
        let random = this.characterService.generateRandomCharacter();

        while (this.currentlySelectedAvatars.includes(random.avatarPath)) {
            random = this.characterService.generateRandomCharacter();
        }

        this.characterName = random.name;
        this.lifeBonusSelected = random.lifeBonus;
        this.attackDiceD6 = random.attackDiceD6;

        this.selectAvatar(random.avatarPath);
    }

    goBack(): void {
        if (this.lobbyId) {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.SelectAvatar, {
                lobbyId: this.lobbyId,
                avatar: null,
            });

            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
            this.router.navigate([this.routes.joinGame]);
        } else {
            this.webSocketService.emitNamespace(SocketNamespace.Join, JoinGameEvents.LeaveLobby);
            this.router.navigate([this.routes.create]);
        }
    }

    ngOnDestroy(): void {
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.GameHosted);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyJoined);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.UpdateOccupiedAvatars);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyUpdated);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.GameDeleted);
        this.webSocketService.offNamespace(SocketNamespace.Join, JoinGameEvents.LobbyError);
    }

}
