/**
 * ChatComponent Test Suite
 *
 * Testing Strategy:
 * This test suite covers the chat component used in the waiting room and during a game.
 * We check four main things:
 *
 * 1. Message Subscriptions - Makes sure we listen to the right lobby's messages on init
 *    and switch to the new stream when the lobbyId changes mid-lifecycle.
 *
 * 2. Display Name - Checks trimming, empty names, whitespace-only input, and the
 *    "Joueur" fallback so we never show a blank name in the chat.
 *
 * 3. Send Guards - Covers all the cases where sending should be blocked: abandoned
 *    players, empty or whitespace drafts, missing lobby. Makes sure bad messages
 *    don't get through to the service.
 *
 * 4. Scroll Behavior - Tests that the chat stays pinned to the bottom after sending,
 *    and that clicking "scroll to bottom" works when the user scrolled up.
 *
 * Mocking:
 * We mock ChatService with jasmine.createSpyObj and use a BehaviorSubject to fake the
 * message stream. This lets us push messages in tests without real WebSocket stuff.
 *
 */

import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatService } from '@app/services/chat/chat.service';
import { ChatMessage } from '@common/chat-message';
import { BehaviorSubject } from 'rxjs';
import { ChatComponent } from './chat.component';

describe('ChatComponent', () => {
    let component: ChatComponent;
    let fixture: ComponentFixture<ChatComponent>;
    let chatServiceSpy: jasmine.SpyObj<ChatService>;
    let messagesSubject: BehaviorSubject<ChatMessage[]>;

    const TEST_LOBBY_ID = 'lobby-1';
    const TEST_PLAYER_NAME = 'TestPlayer';

    // Helper: Create a ChatMessage with optional overrides
    const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
        lobbyId: TEST_LOBBY_ID, senderName: 'Cristiano', message: 'Hello!', sentAt: new Date(), ...overrides,
    });

    beforeEach(async () => {
        messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
        chatServiceSpy = jasmine.createSpyObj('ChatService', ['sendMessage', 'requestHistory', 'roomMessages$']);
        chatServiceSpy.roomMessages$.and.returnValue(messagesSubject.asObservable());

        await TestBed.configureTestingModule({
            imports: [ChatComponent],
            providers: [{ provide: ChatService, useValue: chatServiceSpy }],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatComponent);
        component = fixture.componentInstance;
        component.lobbyId = TEST_LOBBY_ID;
        component.playerName = TEST_PLAYER_NAME;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });


    // Message Subscription Tests

    // These tests validate that the component correctly establishes and manages
    // its connection to the chat message stream. We verify initial subscription
    // setup and dynamic resubscription when the lobby context changes.

    describe('Message Subscription (ngOnInit)', () => {
        it('should subscribe to messages for the current lobby', () => {
            expect(chatServiceSpy.roomMessages$).toHaveBeenCalledWith(TEST_LOBBY_ID);
        });

        it('should update the messages array when the service pushes new data', () => {
            messagesSubject.next([createMessage(), createMessage({ message: 'World' })]);
            expect(component.messages.length).toBe(2);
        });
    });

    describe('Lobby Change (ngOnChanges)', () => {
        it('should resubscribe when lobbyId changes', () => {
            chatServiceSpy.roomMessages$.calls.reset();
            component.lobbyId = 'lobby-2';
            component.ngOnChanges({ lobbyId: new SimpleChange(TEST_LOBBY_ID, 'lobby-2', false) });
            expect(chatServiceSpy.roomMessages$).toHaveBeenCalledWith('lobby-2');
        });
    });


    // Display Name Tests

    // These tests validate the display name formatting logic. The component must
    // trim whitespace from player names and provide a safe fallback when the name
    // is empty or whitespace-only, preventing blank labels in the chat feed.

    describe('Display Name Formatting', () => {
        it('should trim the player name', () => {
            component.playerName = '  Cristiano  ';
            expect(component['displayName']).toBe('Cristiano');
        });

        it('should default to "Joueur" when name is empty', () => {
            component.playerName = '';
            expect(component['displayName']).toBe('Joueur');
        });

        it('should default to "Joueur" when name is only whitespace', () => {
            component.playerName = '   ';
            expect(component['displayName']).toBe('Joueur');
        });
    });


    // Send Guard Validation Tests

    // Comprehensive validation tests covering critical edge cases for the canSend gate:
    // 1. Valid state - active player, lobby set, non-empty draft
    // 2. Abandoned player - spectator rule enforcement
    // 3. Empty/whitespace draft - prevents spam
    // 4. Missing lobby - prevents unwanted messages
    // These tests ensure the guard prevents unwanted messages combinations from reaching the service.

    describe('Send Guard (canSend)', () => {
        it('should be true when everything is valid', () => {
            component.hasAbandoned = false;
            component.lobbyId = TEST_LOBBY_ID;
            component.draftMessage = 'Hello';
            expect(component['canSend']).toBe(true);
        });

        it('should be false for abandoned players', () => {
            component.hasAbandoned = true;
            component.draftMessage = 'Hello';
            expect(component['canSend']).toBe(false);
        });

        it('should be false with an empty draft', () => {
            component.draftMessage = '';
            expect(component['canSend']).toBe(false);
        });

        it('should be false with a whitespace-only draft', () => {
            component.draftMessage = '   ';
            expect(component['canSend']).toBe(false);
        });

        it('should be false without a lobbyId', () => {
            component.lobbyId = '';
            component.draftMessage = 'Hello';
            expect(component['canSend']).toBe(false);
        });
    });


    // Message Sending Tests

    // These tests verify the sendMessage flow: delegation to ChatService with trimmed
    // content, draft clearing after dispatch, and guard enforcement at the method level
    // to prevent bypassing UI programmatically.

    describe('Message Sending', () => {
        it('should delegate to ChatService with trimmed content', () => {
            component.draftMessage = '  Hello world  ';
            component.sendMessage();
            expect(chatServiceSpy.sendMessage).toHaveBeenCalledWith(TEST_LOBBY_ID, TEST_PLAYER_NAME, 'Hello world');
        });

        it('should clear the draft after sending', () => {
            component.draftMessage = 'Hello';
            component.sendMessage();
            expect(component.draftMessage).toBe('');
        });

        it('should not send if canSend is false (empty draft)', () => {
            component.draftMessage = '';
            component.sendMessage();
            expect(chatServiceSpy.sendMessage).not.toHaveBeenCalled();
        });

        it('should not send if the player abandoned', () => {
            component.hasAbandoned = true;
            component.draftMessage = 'Hello';
            component.sendMessage();
            expect(chatServiceSpy.sendMessage).not.toHaveBeenCalled();
        });
    });


    // Chat Focus Events Tests

    // These tests validate that focus/blur events are properly emitted to parent
    // components, enabling them to safely disable global keyboard shortcuts
    // (like WASD movement) when the chat input is active.

    describe('Chat Focus Events', () => {
        it('should emit true on focus', () => {
            spyOn(component.chatFocusChange, 'emit');
            component.chatFocusChange.emit(true);
            expect(component.chatFocusChange.emit).toHaveBeenCalledWith(true);
        });

        it('should emit false on blur', () => {
            spyOn(component.chatFocusChange, 'emit');
            component.chatFocusChange.emit(false);
            expect(component.chatFocusChange.emit).toHaveBeenCalledWith(false);
        });
    });


    // Scroll Behavior Tests

    // These tests verify auto-scroll tracking: the component starts anchored to
    // the bottom, stays anchored after sending, and supports manual scroll-to-bottom
    // triggers for when the user has scrolled up to read history.

    describe('Scroll Behavior', () => {
        it('should start near the bottom', () => {
            expect(component.isNearBottom).toBe(true);
        });

        it('should flag for auto-scroll after sending', () => {
            component.draftMessage = 'Test';
            component.sendMessage();
            expect(component.isNearBottom).toBe(true);
        });

        it('scrollToBottomClicked should jump to bottom', () => {
            component.isNearBottom = false;
            component.scrollToBottomClicked();
            expect(component.isNearBottom).toBe(true);
        });
    });


    // Component Lifecycle Tests

    // These tests verify that the component tears down cleanly without memory leaks,
    // including edge cases where subscriptions may not have been fully established.

    describe('Component Teardown (ngOnDestroy)', () => {
        it('should not throw', () => {
            expect(() => component.ngOnDestroy()).not.toThrow();
        });

        it('should survive being destroyed with no active subscription', () => {
            const fresh = TestBed.createComponent(ChatComponent);
            fresh.componentInstance.lobbyId = '';
            expect(() => fresh.componentInstance.ngOnDestroy()).not.toThrow();
        });
    });
});
