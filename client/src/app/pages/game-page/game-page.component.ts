import { Component, OnInit, effect } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { Game } from '@common/game';
import { GameMode } from '@common/enums';
import { Lobby } from '@common/lobby';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@app/constants/routes.constants';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { player1, player2, testGame699112c9, testLobby } from '@app/constants/tempGame.constants';
import { OBJECT_PLACEMENT_TOOL, TILE_TOOLS } from '@app/constants/map-setup-page-constant';
import { Player } from '@common/player';
import { GameViewService } from '@app/services/game-view/game-view.service';

@Component({
    selector: 'app-game-page',
    imports: [ButtonComponent, RouterLink, SakuraComponent],
    templateUrl: './game-page.component.html',
    styleUrl: './game-page.component.scss',
})
export class GamePageComponent implements OnInit {
    readonly items = OBJECT_PLACEMENT_TOOL;
    readonly tiles = TILE_TOOLS;
    readonly routes = ROUTES;

    protected gameMode = GameMode;

    lobby: Lobby = testLobby;
    game: Game = testGame699112c9;
    activePlayer: Player = player1;
    localPlayer: Player = player2;

    isMyTurn: boolean = false;

    constructor(private readonly gameViewService: GameViewService) {
        effect(() => {
            const lobby = this.gameViewService.gameLobby();
            if (lobby) {
                this.lobby = lobby;
                this.game = lobby.game;
                const myId = this.gameViewService.getLocalSocketId();
                const foundPlayer = lobby.players.find((p) => p.socketId === myId);
                if (foundPlayer) {
                    this.localPlayer = foundPlayer;
                }
            }
        });
    }

    ngOnInit(): void {
        console.log('GamePageComponent initialized');
    }

    onEndTurn() {
        this.gameViewService.sendEndTurn(this.lobby.lobbyId);
    }

    onAbandon() {
        this.gameViewService.sendAbandon(this.lobby.lobbyId);
    }

    onAction() {
        this.gameViewService.sendAction(this.lobby.lobbyId, null);
    }
}
