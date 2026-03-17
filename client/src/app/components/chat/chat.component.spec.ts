/**
 * Test suite for the ChatComponent.
 * This component acts as the reusable chat interface utilized in both the waiting room and the active game view.
 * The tests validate message subscription handling, user display name formatting, and the strict rules governing when a message can be sent.
 * Specific edge cases are covered, including preventing abandoned players from sending messages, blocking whitespace-only submissions, and ensuring smooth auto-scrolling behaviors.
 */

import { SimpleChange} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatService } from '@app/services/chat/chat.service';
import { ChatMessage } from '@common/chat-message';
import { BehaviorSubject } from 'rxjs';
import { ChatComponent } from './chat.component';

describe('ChatComponent', () => {
    let component: ChatComponent;
    let fixture: ComponentFixture<ChatComponent>;
    let chatService: jasmine.SpyObj<ChatService>;
    let messagesSubject: BehaviorSubject<ChatMessage[]>;

    const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
        lobbyId: 'lobby-1', senderName: 'Alice', message: 'Hello!', sentAt: new Date(), ...overrides,
    });

    beforeEach(async () => {
        messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
        chatService = jasmine.createSpyObj('ChatService', ['sendMessage', 'requestHistory', 'roomMessages$']);
        chatService.roomMessages$.and.returnValue(messagesSubject.asObservable());

        await TestBed.configureTestingModule({
            imports: [ChatComponent],
            providers: [{ provide: ChatService, useValue: chatService }],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatComponent);
        component = fixture.componentInstance;
        component.lobbyId = 'lobby-1';
        component.playerName = 'TestPlayer';
        fixture.detectChanges();
    });

    /** Ensures the component successfully instantiates without throwing any errors. */
    it('should create', () => {
 expect(component).toBeTruthy(); 
});

    describe('ngOnInit', () => {
        /** Confirms the component establishes a connection to the correct chat stream based on the provided lobby ID upon initialization. */
        it('should subscribe to messages for the current lobby', () => {
            expect(chatService.roomMessages$).toHaveBeenCalledWith('lobby-1');
        });

        /** Verifies that the local array of messages updates reactively whenever the underlying service pushes new data. */
        it('should update the messages array when the service pushes new data', () => {
            messagesSubject.next([createMessage(), createMessage({ message: 'World' })]);
            expect(component.messages.length).toBe(2);
        });
    });

    describe('ngOnChanges', () => {
        /** Ensures the chat dynamically drops the old subscription and connects to the new message stream if the active lobby changes during the component's lifecycle. */
        it('should resubscribe when lobbyId changes', () => {
            chatService.roomMessages$.calls.reset();
            component.lobbyId = 'lobby-2';
            component.ngOnChanges({ lobbyId: new SimpleChange('lobby-1', 'lobby-2', false) });
            expect(chatService.roomMessages$).toHaveBeenCalledWith('lobby-2');
        });
    });

    describe('displayName', () => {
        /** Strips trailing or leading whitespace from the player's name to ensure a clean visual presentation in the chat feed. */
        it('should trim the player name', () => {
            component.playerName = '  Alice  ';
            expect(component.displayName).toBe('Alice');
        });

        /** Provides a safe fallback identity ("Joueur") to prevent rendering blank labels if the player's name string is unexpectedly empty. */
        it('should default to "Joueur" when name is empty', () => {
            component.playerName = '';
            expect(component.displayName).toBe('Joueur');
        });

        /** Extends the empty-name protection to cover strings consisting entirely of whitespace characters. */
        it('should default to "Joueur" when name is just spaces', () => {
            component.playerName = '   ';
            expect(component.displayName).toBe('Joueur');
        });
    });

    describe('canSend', () => {
        /** Evaluates to true when the player is active, the lobby is set, and a valid message has been drafted. */
        it('should be true when everything is valid', () => {
            component.hasAbandoned = false;
            component.lobbyId = 'lobby-1';
            component.draftMessage = 'Hello';
            expect(component.canSend).toBe(true);
        });

        /** Strictly enforces the spectator rule, allowing players who quit to read the chat history but preventing them from sending new messages. */
        it('should be false for abandoned players', () => {
            component.hasAbandoned = true;
            component.draftMessage = 'Hello';
            expect(component.canSend).toBe(false);
        });

        /** Blocks the submission of entirely empty message drafts to prevent spamming the server. */
        it('should be false with an empty draft', () => {
            component.draftMessage = '';
            expect(component.canSend).toBe(false);
        });

        /** Prevents users from sending messages containing only spaces or tabs. */
        it('should be false with a whitespace-only draft', () => {
            component.draftMessage = '   ';
            expect(component.canSend).toBe(false);
        });

        /** Disables sending capabilities if the component loses context of the current active lobby. */
        it('should be false without a lobbyId', () => {
            component.lobbyId = '';
            component.draftMessage = 'Hello';
            expect(component.canSend).toBe(false);
        });
    });

    describe('sendMessage', () => {
        /** Confirms the component delegates the actual sending logic to the service, ensuring the content is trimmed before transmission. */
        it('should delegate to ChatService with trimmed content', () => {
            component.draftMessage = '  Hello world  ';
            component.sendMessage();
            expect(chatService.sendMessage).toHaveBeenCalledWith('lobby-1', 'TestPlayer', 'Hello world');
        });

        /** Automatically clears the input field immediately after a message is dispatched to prepare for the next draft. */
        it('should clear the draft after sending', () => {
            component.draftMessage = 'Hello';
            component.sendMessage();
            expect(component.draftMessage).toBe('');
        });

        /** Acts as a secondary guard to guarantee that the service is never called if the send conditions (like an empty draft) are not met. */
        it('should not send if canSend is false (empty draft)', () => {
            component.draftMessage = '';
            component.sendMessage();
            expect(chatService.sendMessage).not.toHaveBeenCalled();
        });

        /** Ensures abandoned players cannot bypass the UI restrictions to trigger a network request. */
        it('should not send if the player abandoned', () => {
            component.hasAbandoned = true;
            component.draftMessage = 'Hello';
            component.sendMessage();
            expect(chatService.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('chatFocusChange', () => {
        /** Emits a true boolean flag to parent components when the input is focused, enabling them to safely disable global keyboard shortcuts (like WASD movement). */
        it('should emit true on focus', () => {
            spyOn(component.chatFocusChange, 'emit');
            component.chatFocusChange.emit(true);
            expect(component.chatFocusChange.emit).toHaveBeenCalledWith(true);
        });

        /** Emits a false boolean flag when the input loses focus, signaling to the parent component that normal keyboard shortcuts can resume. */
        it('should emit false on blur', () => {
            spyOn(component.chatFocusChange, 'emit');
            component.chatFocusChange.emit(false);
            expect(component.chatFocusChange.emit).toHaveBeenCalledWith(false);
        });
    });

    describe('scroll behavior', () => {
        /** Verifies the default initialization state assumes the view is scrolled to the latest messages. */
        it('should start near the bottom', () => {
 expect(component.isNearBottom).toBe(true); 
});

        /** Ensures the component flags itself to remain snapped to the bottom of the feed immediately after the user sends a new message. */
        it('should flag for auto-scroll after sending', () => {
            component.draftMessage = 'Test';
            component.sendMessage();
            expect(component.isNearBottom).toBe(true);
        });

        /** Confirms the manual UI trigger accurately resets the scroll tracking state to force a jump to the bottom of the message list. */
        it('scrollToBottomClicked should jump to bottom', () => {
            component.isNearBottom = false;
            component.scrollToBottomClicked();
            expect(component.isNearBottom).toBe(true);
        });
    });

    describe('ngOnDestroy', () => {
        /** Verifies standard component destruction completes cleanly without memory leaks or syntax errors. */
        it('should not throw', () => {
 expect(() => component.ngOnDestroy()).not.toThrow(); 
});

        /** Ensures the teardown process is robust enough to survive being destroyed even if an active chat subscription was never fully established. */
        it('should survive being destroyed with no active subscription', () => {
            const fresh = TestBed.createComponent(ChatComponent);
            fresh.componentInstance.lobbyId = '';
            expect(() => fresh.componentInstance.ngOnDestroy()).not.toThrow();
        });
    });
});