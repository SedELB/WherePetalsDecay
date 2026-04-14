import { Component, Input } from '@angular/core';
import { GameMode } from '@common/enums';
import { Player } from '@common/player';

@Component({
    selector: 'app-players-list',
    standalone: true,
    templateUrl: './players-list.component.html',
    styleUrl: './players-list.component.scss',
})
export class PlayersListComponent {
    @Input({ required: true }) orderedPlayers!: Player[];
    @Input({ required: true }) activePlayerSocketId!: string | null;
    @Input({ required: true }) gameMode!: GameMode;
    @Input() teamA: Player[] = [];
    @Input() teamB: Player[] = [];

    protected readonly gameModeEnum = GameMode;
}
