import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '@app/services/chat/chat.service';
import { ChatMessage } from '@common/chat-message';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.component.html',
  styleUrl: './chat.component.component.scss',
})
export class ChatComponentComponent implements OnInit, OnDestroy, OnChanges {
  @Input() lobbyId: string = 'lobby';
  @Input() playerName: string = '';
  @Input() hasAbandoned: boolean = false;

  draftMessage = '';
  messages: ChatMessage[] = [];

  private messagesSub?: Subscription;

  constructor(private readonly chatService: ChatService) {}

  ngOnInit(): void {
    this.subscribeToMessages();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.lobbyId && this.lobbyId) {
      this.subscribeToMessages();
    }
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
  }

  get displayName(): string {
    return this.playerName?.trim() || 'Joueur';
  }

  get canSend(): boolean {
    return Boolean(!this.hasAbandoned && this.lobbyId.trim() && this.draftMessage.trim().length > 0);
  }

  sendMessage(): void {
    if (!this.canSend) return;
    const message = this.draftMessage.trim();
    this.draftMessage = '';
    this.chatService.sendMessage(this.lobbyId, this.displayName, message);
  }

  private subscribeToMessages(): void {
    
    const lobbyId = this.lobbyId?.trim();
    if (!lobbyId) return;

    this.messagesSub = this.chatService.roomMessages$(lobbyId).subscribe((msgs) => {
      this.messages = msgs;
    });
  }
}
