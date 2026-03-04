import { Component, Input } from '@angular/core';
import { GameMode } from '@common/enums';
import { Lobby } from '@common/lobby';

@Component({
  selector: 'app-lobby-card',
  imports: [],
  templateUrl: './lobby-card.component.html',
  styleUrl: './lobby-card.component.scss',
})
export class LobbyCardComponent {
  @Input() lobby!: Lobby;
  readonly gameMode = GameMode;
}
