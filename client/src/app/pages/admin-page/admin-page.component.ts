import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { GameCard } from '@app/interfaces/game-card';
import { AdminGameService } from '@app/services/admin-game/admin-game.service';
import { CommunicationService } from '@app/services/communication/communication.service';
import { MapSetupMode } from '@common/enums';
import { Game } from '@common/game';
import { Subscription } from 'rxjs';
import swal from 'sweetalert2';

@Component({
    selector: 'app-admin-page',
    imports: [GameCardComponent, ButtonComponent],
    templateUrl: './admin-page.component.html',
    styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit, OnDestroy {
    private games: Game[] = [];
    gameCards: GameCard[] = [];

    private subscription?: Subscription;

    constructor(
        private readonly communicationService: CommunicationService,
        private readonly adminGameService: AdminGameService,
        private readonly router: Router,
    ) {}

    ngOnInit(): void {
        this.adminGameService.fetchAllGames().subscribe({
            next: (games) => this.adminGameService.setGames(games),
            error: (error: HttpErrorResponse) => {
                const errorMessage = error.error || 'Erreur lors de la récupération des jeux';
                swal.fire({
                    title: `Erreur`,
                    text: `${errorMessage}`,
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            },
        });

        this.subscription = this.adminGameService.games$.subscribe((games) => {
            this.games = games;
            this.gameCards = games
                .map((game) => ({
                    name: game.name,
                    description: game.description,
                    size: game.size,
                    gameMode: game.gameMode,
                    thumbnail: game.thumbnail,
                    createdAt: game.createdAt,
                    updatedAt: game.updatedAt,
                    isVisible: game.isVisible,
                }))
                .sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                    return dateA.getTime() - dateB.getTime();
                });
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }

    navigateToGameEditor(name: string): void {
        const selectedGame = this.games.find((gameItem) => gameItem.name === name);
        this.router.navigate(['/editor', selectedGame?._id], { state: { game: selectedGame, mode: MapSetupMode.Edit } });
    }

    changeVisibility(name: string): void {
        const game = this.games.find((g) => g.name === name);
        if (!game) return;
        this.communicationService.updateVisiblity(game).subscribe({
            error: (error: HttpErrorResponse) => {
                const errorMessage = error.error || 'Erreur lors du changement de visibilité';
                swal.fire({
                    title: `Erreur`,
                    text: `${errorMessage}`,
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            },
        });
    }

    async removeGame(name: string): Promise<void> {
        const game = this.games.find((g) => g.name === name);
        if (!game) return;

        const result = await swal.fire({
            title: 'Êtes-vous sûrs de vouloir supprimer ce jeu ?',
            text: `Cette action est irréversible.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
        });

        if (result.isConfirmed) {
            this.communicationService.deleteGame(game._id).subscribe({
                error: (error: HttpErrorResponse) => {
                    const errorMessage = error.error || 'Erreur lors de la suppression du jeu';
                    swal.fire({
                        title: `Erreur`,
                        text: `${errorMessage}`,
                        icon: 'error',
                        confirmButtonText: 'OK',
                    });
                },
            });
        }
    }
}
