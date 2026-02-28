import { NgClass } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { GameCard } from '@app/interfaces/gameCard';
import { GameMode } from '@common/enums';

@Component({
  selector: 'app-game-card',
  imports: [NgClass],
  standalone: true,
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})

export class GameCardComponent {
  @Input() game: GameCard = {
    name: '',
    description: '',
    size: { rows: 0, cols: 0 },
    gameMode: GameMode.Classic,
    thumbnail: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isVisible: true,
  };

  @ViewChild('tooltip') tooltipRef!: ElementRef;
  @ViewChild('thumbnail') thumbnailRef!: ElementRef;

  show = false;
  gameMode = GameMode;
  tooltipVerticalPos: number = 0;
  tooltipTopPadding : number = 140;

  displayTime(): string {
    const rawDate = this.game.updatedAt;
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  onMouseEnter() : void {
    this.show = true;
    this.updateTooltipPosition();
  }

  onMouseLeave() : void {
    this.show = false;
    this.tooltipVerticalPos = 0;
  }

  updateTooltipPosition() : void {
    const rect = this.thumbnailRef.nativeElement.getBoundingClientRect();
    const tooltipHeight = this.tooltipRef.nativeElement.offsetHeight;
    const windowHeight = window.innerHeight;
    const tooltipPadding = 10;

    const centerOfThumbnail = rect.top + rect.height / 2;
    const maxTop = windowHeight - tooltipHeight - tooltipPadding;

    this.tooltipVerticalPos = Math.min(Math.max(centerOfThumbnail - tooltipHeight / 2, this.tooltipTopPadding), maxTop);
  }

}