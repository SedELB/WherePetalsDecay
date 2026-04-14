import { Component, Input } from '@angular/core';
import { GameMode } from '@common/enums';
import { GameOverEventData } from '@common/interfaces/game-view';

@Component({
    selector: 'app-game-over-overlay',
    standalone: true,
    templateUrl: './game-over-overlay.component.html',
    styleUrl: './game-over-overlay.component.scss',
})
export class GameOverOverlayComponent {
    @Input({ required: true }) gameOver!: GameOverEventData;
    @Input({ required: true }) localPlayerSocketId!: string | undefined;
    @Input({ required: true }) winnerName!: string;
    @Input({ required: true }) gameMode!: GameMode;

    protected readonly gameModeEnum = GameMode;
}
