/**
 * Test suite for the ChatService.
 * This service manages real-time messaging over WebSockets, appending single incoming messages and fully replacing histories when requested.
 * The tests validate message formatting constraints on the outgoing side (such as maximum character limits and whitespace trimming).
 */

import { TestBed } from '@angular/core/testing';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { ChatMessage } from '@common/chat-message';
import { SocketNamespace } from '@common/enums';
import { JoinGameEvents } from '@common/join.gateway.events';
import { ChatService } from './chat.service';

describe('ChatService', () => {
    let service: ChatService;
    let webSocketService: jasmine.SpyObj<WebSocketService>;
    const capturedCallbacks = new Map<string, (...args: unknown[]) => void>();

    const EXPECTED_MESSAGES = 3;
    const OVER_LIMIT_LENGTH = 250;
    const MAX_MESSAGE_LENGTH = 200;

    const createWebSocketMock = () => {
        const mock = jasmine.createSpyObj('WebSocketService', ['onNamespace', 'offNamespace', 'emitNamespace', 'getSocketId']);
        mock.onNamespace.and.callFake((_ns: string, event: string, cb: (...args: unknown[]) => void) => {
            capturedCallbacks.set(event, cb);
        });
        return mock;
    };

    const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
        lobbyId: 'lobby-1', senderName: 'Alice', message: 'Hello!', sentAt: new Date(), ...overrides,
    });

    beforeEach(() => {
        capturedCallbacks.clear();
        TestBed.configureTestingModule({
            providers: [ChatService, { provide: WebSocketService, useValue: createWebSocketMock() }],
        });
        webSocketService = TestBed.inject(WebSocketService) as jasmine.SpyObj<WebSocketService>;
        service = TestBed.inject(ChatService);
    });

    /** Ensures the service successfully instantiates without throwing any dependency injection errors. */
    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('constructor', () => {
        /** Verifies that the service immediately binds listeners for both individual chat updates and bulk history payloads. */
        [JoinGameEvents.ReceivedChatMessage, JoinGameEvents.ChatHistorySent].forEach((event) => {
            it(`should listen for ${event}`, () => {
                expect(webSocketService.onNamespace).toHaveBeenCalledWith(SocketNamespace.Join, event, jasmine.any(Function));
            });
        });
    });

    describe('ReceivedChatMessage', () => {
        /** Confirms that a newly broadcasted message from the server is correctly appended to the reactive message feed. */
        it('should append a message to the history', (done) => {
            capturedCallbacks.get(JoinGameEvents.ReceivedChatMessage)?.(createMessage());
            service.chatHistory$.subscribe((msgs) => {
                expect(msgs.length).toBe(1);
                done();
            });
        });

        /** Asserts that messages strictly maintain their chronological order of arrival within the internal history array. */
        it('should keep messages in order as they arrive', (done) => {
            capturedCallbacks.get(JoinGameEvents.ReceivedChatMessage)?.(createMessage({ message: 'First' }));
            capturedCallbacks.get(JoinGameEvents.ReceivedChatMessage)?.(createMessage({ message: 'Second' }));
            capturedCallbacks.get(JoinGameEvents.ReceivedChatMessage)?.(createMessage({ message: 'Third' }));
            service.chatHistory$.subscribe((msgs) => {
                expect(msgs.length).toBe(EXPECTED_MESSAGES);
                expect(msgs[0].message).toBe('First');
                expect(msgs[2].message).toBe('Third');
                done();
            });
        });
    });

    describe('ChatHistorySent', () => {
        /** Ensures the service completely wipes its existing cache and replaces it with the bulk payload when reconnecting. */
        it('should replace the full history (not append)', (done) => {
            capturedCallbacks.get(JoinGameEvents.ReceivedChatMessage)?.(createMessage({ message: 'Old' }));
            capturedCallbacks.get(JoinGameEvents.ChatHistorySent)?.([createMessage({ message: 'Msg1' }), createMessage({ message: 'Msg2' })]);
            service.chatHistory$.subscribe((msgs) => {
                expect(msgs.length).toBe(2);
                expect(msgs[0].message).toBe('Msg1');
                done();
            });
        });

        /** Gracefully accepts an empty array payload if the server indicates that no chat history currently exists for the specified room. */
        it('should handle an empty history from the server', (done) => {
            capturedCallbacks.get(JoinGameEvents.ChatHistorySent)?.([]);
            service.chatHistory$.subscribe((msgs) => {
                expect(msgs.length).toBe(0);
                done();
            });
        });
    });

    describe('sendMessage', () => {
        /** Formats outgoing messages by stripping away leading and trailing whitespace before dispatching the payload to the server. */
        it('should emit with the trimmed message', () => {
            service.sendMessage('lobby-1', 'Alice', '  Hello world  ');
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
                SocketNamespace.Join, JoinGameEvents.ChatSendMessage,
                { lobbyId: 'lobby-1', message: 'Hello world', senderName: 'Alice' },
            );
        });

        /** Prevents unnecessary network requests by silently blocking transmissions if the message consists entirely of whitespace characters. */
        it('should not emit when the message is just whitespace', () => {
            service.sendMessage('lobby-1', 'Alice', '   ');
            expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
        });

        /** Blocks the transmission if a target lobby identifier is not provided to prevent routing errors on the server side. */
        it('should not emit when lobbyId is empty', () => {
            service.sendMessage('', 'Alice', 'Hello');
            expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
        });

        /** Enforces a strict server-side constraint by automatically truncating any string exceeding the maximum limit of 200 characters. */
        it('should truncate messages longer than 200 characters', () => {
            service.sendMessage('lobby-1', 'Alice', 'A'.repeat(OVER_LIMIT_LENGTH));
            const payload = webSocketService.emitNamespace.calls.mostRecent().args[2] as unknown;
            expect((payload as { message: string }).message.length).toBe(MAX_MESSAGE_LENGTH);
        });

        /** Formats the user's display name alongside the message content to ensure a clean visual presentation for all clients. */
        it('should trim the sender name too', () => {
            service.sendMessage('lobby-1', '  Bob  ', 'Hi');
            const payload = webSocketService.emitNamespace.calls.mostRecent().args[2] as unknown;
            expect((payload as { senderName: string }).senderName).toBe('Bob');
        });
    });

    describe('requestHistory', () => {
        /** Pings the server explicitly to request a full dump of the chat history for a newly joined or reconnected session. */
        it('should ask the server for chat history', () => {
            service.requestHistory('lobby-1');
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(SocketNamespace.Join, JoinGameEvents.ChatHistoryRequest, 'lobby-1');
        });

        /** Aborts the server request if the lobby identifier is missing to prevent processing invalid queries. */
        it('should skip the request if lobbyId is empty', () => {
            service.requestHistory('');
            expect(webSocketService.emitNamespace).not.toHaveBeenCalled();
        });
    });

    describe('roomMessages$', () => {
        /** Exposes a cleanly formatted observable stream of the chat feed for UI components to safely subscribe to. */
        it('should return an observable of the chat history', (done) => {
            capturedCallbacks.get(JoinGameEvents.ChatHistorySent)?.([createMessage({ message: 'Test' })]);
            service.roomMessages$('lobby-1').subscribe((msgs) => {
                expect(msgs.length).toBe(1);
                done();
            });
        });

        /** Automatically triggers a background request to fetch existing history from the server the moment a component subscribes to the stream. */
        it('should request history as a side effect', () => {
            service.roomMessages$('lobby-1');
            expect(webSocketService.emitNamespace).toHaveBeenCalledWith(SocketNamespace.Join, JoinGameEvents.ChatHistoryRequest, 'lobby-1');
        });
    });
});