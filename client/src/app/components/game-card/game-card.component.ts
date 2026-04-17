import { NgClass } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnInit, ViewChild } from '@angular/core';
import { GameCard } from '@app/interfaces/game-card';
import { GameMode } from '@common/enums';

@Component({
  selector: 'app-game-card',
  imports: [NgClass],
  standalone: true,
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})

export class GameCardComponent implements OnInit {
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

  @ViewChild('tooltip') private tooltipRef!: ElementRef;
  @ViewChild('thumbnail') private thumbnailRef!: ElementRef;

  show = false;
  gameMode = GameMode;
  tooltipVerticalPos: number = 0;
  tooltipHorizontalPos: number = 0;
  private readonly tooltipTopPadding: number = 140;
  private windowHeight: number = 0;

  ngOnInit(): void {
    this.windowHeight = visualViewport?.height ?? 0;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.windowHeight = visualViewport?.height ?? 0;
  }

  protected displayTime(): string {
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
  onMouseEnter(): void {
    this.show = true;
    this.updateTooltipPosition();
  }

  onMouseLeave(): void {
    this.show = false;
  }

  updateTooltipPosition(): void {
    const rect = this.thumbnailRef.nativeElement.getBoundingClientRect();
    const tooltipHeight = this.tooltipRef.nativeElement.offsetHeight;
    const tooltipPadding = 50;

    const centerOfThumbnail = rect.top + rect.height / 2;
    const maxTop = this.windowHeight - tooltipHeight - tooltipPadding;

    this.tooltipVerticalPos = Math.min(Math.max(centerOfThumbnail - tooltipHeight / 2, this.tooltipTopPadding), maxTop);
    this.tooltipHorizontalPos = rect.left - this.tooltipRef.nativeElement.offsetWidth - tooltipPadding;
  }

}
