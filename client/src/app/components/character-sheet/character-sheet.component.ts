import { Component, Input } from '@angular/core';
import { Player } from '@common/player';

@Component({
    selector: 'app-character-sheet',
    standalone: true,
    templateUrl: './character-sheet.component.html',
    styleUrl: './character-sheet.component.scss',
})
export class CharacterSheetComponent {
    @Input() player: Player | undefined | null;
    @Input() maxLife!: number;
    @Input() movementPoints!: number;
    @Input() actionPoints!: number;
}
