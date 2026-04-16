import { Component, ElementRef, HostListener, Input, OnInit, ViewChild } from '@angular/core';
import { GameMode } from '@common/enums';
import { Lobby } from '@common/lobby';

@Component({
  selector: 'app-lobby-card',
  imports: [],
  templateUrl: './lobby-card.component.html',
  styleUrl: './lobby-card.component.scss',
})
export class LobbyCardComponent implements OnInit {
  @Input() lobby!: Lobby;
  readonly gameMode = GameMode;
  @ViewChild('tooltip') private tooltipRef!: ElementRef;
  @ViewChild('thumbnail') private thumbnailRef!: ElementRef;

  show = false;
  tooltipVerticalPos: number = 0;
  tooltipHorizontalPos: number = 0;
  tooltipTopPadding: number = 140;
  private windowHeight: number = 0;

  ngOnInit(): void {
    this.windowHeight = visualViewport?.height ?? 0;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.windowHeight = visualViewport?.height ?? 0;
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
