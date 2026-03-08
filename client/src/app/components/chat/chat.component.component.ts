import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatMessage, ChatService } from '@app/services/chat/chat.service';
import { Subscription } from 'rxjs';

const CHAT_NAME_STORAGE_KEY = 'chat.playerName';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.component.html',
  styleUrl: './chat.component.component.scss',
})
export class ChatComponentComponent implements OnInit, OnDestroy, OnChanges {
  @Input() roomId: string = 'lobby';
  @Input() playerName: string = '';
  @Input() hasAbandoned: boolean = false;

  connected = false;
  draftMessage = '';
  messages: ChatMessage[] = [];

  private connectedSub?: Subscription;
  private messagesSub?: Subscription;
  private activeRoomId: string | null = null;

  constructor(private readonly chatService: ChatService) {}

  ngOnInit(): void {
    // nom local (pour pouvoir afficher un nom dans l'entête même si la page ne le fournit pas)
    if (!this.playerName) {
      const stored = localStorage.getItem(CHAT_NAME_STORAGE_KEY);
      if (stored) this.playerName = stored;
    }

    this.connectedSub = this.chatService.connected$.subscribe((isConnected) => {
      this.connected = isConnected;
    });

    this.joinAndSubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['roomId'] && !changes['roomId'].firstChange) {
      this.joinAndSubscribe();
    }
  }

  ngOnDestroy(): void {
    this.connectedSub?.unsubscribe();
    this.messagesSub?.unsubscribe();
  }

  get displayName(): string {
    return this.playerName?.trim() || 'Joueur';
  }

  get canSend(): boolean {
    return Boolean(!this.hasAbandoned && this.connected && this.roomId.trim() && this.draftMessage.trim().length > 0);
  }

  onPlayerNameChange(name: string): void {
    this.playerName = name;
    localStorage.setItem(CHAT_NAME_STORAGE_KEY, name);
  }

  sendMessage(): void {
    if (!this.canSend) return;
    const message = this.draftMessage.trim();
    this.draftMessage = '';
    this.chatService.sendMessage(this.roomId, this.displayName, message);
  }

  private joinAndSubscribe(): void {
    const room = this.roomId?.trim();
    if (!room) return;

    // Important: quitter l'ancienne room pour ne pas recevoir les messages d'une autre partie
    if (this.activeRoomId && this.activeRoomId !== room) {
      this.chatService.leaveRoom(this.activeRoomId, this.displayName);
    }

    this.chatService.joinRoom(room, this.displayName);
    this.activeRoomId = room;

    this.messagesSub?.unsubscribe();
    this.messagesSub = this.chatService.roomMessages$(room).subscribe((msgs) => {
      this.messages = msgs;
    });
  }
}
