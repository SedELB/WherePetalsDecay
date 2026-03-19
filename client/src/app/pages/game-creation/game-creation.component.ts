import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { ROUTES } from '@app/constants/routes.constants';
import { GameCreationService } from '@app/services/game-creation/game-creation.service';
import { ButtonVariant } from '@common/enums';
import { Game } from '@common/game';
import { Subscription } from 'rxjs';
import swal from 'sweetalert2';

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
    styleUrl: './game-creation.component.scss',
})

export class GameCreationComponent implements OnInit, OnDestroy {
    protected readonly ButtonVariant = ButtonVariant;
    protected games: Game[] = [];
    private gamesSubscription: Subscription | null = null;
    readonly routes = ROUTES;

    constructor(
        private readonly router: Router,
        private readonly gameCreationService: GameCreationService,
    ) {}

    ngOnInit(): void {
        this.gameCreationService.fetchVisibleGames().subscribe({
            next: (games) => this.gameCreationService.setGames(games),
            error: (error: HttpErrorResponse) => {
                const errorMessage = error.error || 'Erreur lors de la récupération des jeux';
                swal.fire({
                    title: 'Erreur',
                    text: `${errorMessage}`,
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            },
        });

        this.gamesSubscription = this.gameCreationService.visibleGames$.subscribe((games) => {
            this.games = games.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateA.getTime() - dateB.getTime();
            });
        });
    }

    selectGame(game: Game): void {
        this.router.navigate(['/character-selection'], { state: { game } });
    }

    getGameSizeLabel(game: Game): { rows: number, cols: number } {
        return game.size;
    }

    ngOnDestroy(): void {
        this.gamesSubscription?.unsubscribe();
    }
}
