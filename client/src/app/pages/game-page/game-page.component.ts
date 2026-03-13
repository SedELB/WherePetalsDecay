import { Component, OnInit, computed } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { GameMode } from '@common/enums';
import { Router } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/constants/map-setup-page-constant';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { ChatComponent } from '@app/components/chat/chat.component';
import swal from 'sweetalert2';

@Component({
    selector: 'app-game-page',
    imports: [ButtonComponent, SakuraComponent, ChatComponent],
    templateUrl: './game-page.component.html',
    styleUrl: './game-page.component.scss',
})
export class GamePageComponent implements OnInit {
    readonly items = OBJECT_PLACEMENT_TOOL;
    readonly tiles = TILE_TOOLS;
    readonly routes = ROUTES;

    protected gameMode = GameMode;

    readonly lobby = computed(() => this.gameViewService.gameLobby());
    readonly game = computed(() => this.lobby()?.game);

    readonly localPlayer = computed(() => {
        const localPlayerId = this.gameViewService.getLocalSocketId();
        return this.lobby()?.players.find((p) => p.socketId === localPlayerId);
    });

    readonly activePlayer = computed(() => this.lobby()?.players[0]);

    readonly isMyTurn = computed(() => this.activePlayer()?.socketId === this.gameViewService.getLocalSocketId());

    constructor(
        private readonly gameViewService: GameViewService,
        private readonly router: Router,
    ) {}

    ngOnInit(): void {
        if (!this.lobby()) {
            this.router.navigate([this.routes.home]);
        }
    }

    onEndTurn() {
        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendEndTurn(lobbyId);
    }

    onAbandon() {
        const errorMessage = 'Êtes-vous sûr de vouloir abandonner la partie ? Vous ne pourrez pas revenir dans cette partie si vous quittez.';
        swal.fire({
            title: 'Quitter ?',
            text: `${errorMessage}`,
            icon: 'warning',
            confirmButtonText: 'Abandonner',
            cancelButtonText: 'Annuler',
            showCancelButton: true,
        }).then((result) => {
            if (result.isConfirmed) {
                const lobbyId = this.lobby()?.lobbyId;
                if (lobbyId) this.gameViewService.sendAbandon(lobbyId);
            }
        });
    }

    onAction() {
        const lobbyId = this.lobby()?.lobbyId;
        if (lobbyId) this.gameViewService.sendAction(lobbyId, null);
    }
}
