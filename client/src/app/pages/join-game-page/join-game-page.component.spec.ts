/**
 * JoinGamePageComponent Test Suite
 *
 * Testing Strategy:
 * This test suite validates the lobby browsing and joining workflow. We test four core aspects:
 *
 * 1. WebSocket Event Subscription - Verifies that ngOnInit properly sets up listeners for
 *    two critical events: UpdatedLobbiesList (receives array of Lobby[]) and LobbyJoined
 *    (receives single Lobby). Tests confirm callbacks are registered with correct event names
 *    and namespace.
 *
 * 2. Lobby List Management - Tests that the activeLobbies property is initialized as empty
 *    and correctly updates when UpdatedLobbiesList events are received from the WebSocket.
 *    Validates the binding between WebSocket data and component state.
 *
 * 3. Lobby Selection and Navigation - Tests the selectLobby() method which navigates to
 *    character-selection with the lobbyId parameter and passes the game object in router state.
 *
 * 4. Cleanup and Subscription Management - Verifies ngOnDestroy properly unsubscribes from
 *    both WebSocket event listeners using offNamespace to prevent memory leaks.
 *
 * WebSocket Mocking Strategy:
 * We mock WebSocketService with a spy that uses callFake to conditionally handle different
 * event types. The onNamespace spy captures callbacks for specific events (identified by
 * the event parameter), allowing us to manually invoke them during tests. This simulates
 * real WebSocket event flow while maintaining clean test isolation.
 *
 * Network Latency Simulation:
 * For more realistic testing scenarios where event handling might involve async operations,
 * tests can be wrapped with setTimeout delays (500-5000ms) when testing WebSocket event ordering or
 * callback timing requirements.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { WebSocketService } from '@app/services/web-socket/web-socket.service';
import { GameMode, SocketNamespace } from '@common/enums';
import { Game } from '@common/game';
import { JoinGameEvents } from '@common/join.gateway.events';
import { Lobby } from '@common/lobby';
import { JoinGamePageComponent } from './join-game-page.component';

describe('JoinGamePageComponent', () => {
  let component: JoinGamePageComponent;
  let fixture: ComponentFixture<JoinGamePageComponent>;
  let webSocketService: jasmine.SpyObj<WebSocketService>;
  let router: Router;
  const BASE_4500 = 4500;
  const BASE_500 = 500;

  const mockGame: Game = {
    _id: '1',
    name: 'Test Game',
    description: 'Test Description',
    size: { rows: 10, cols: 10 },
    gameMode: GameMode.Classic,
    thumbnail: 'test.png',
    maxPlayers: 4,
    grid: [],
    isVisible: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockLobbies: Lobby[] = [
    {
      lobbyId: 'lobby-1',
      gameId: '1',
      game: mockGame,
      hostSocketId: 'socket-1',
      playerCount: 2,
      isLocked: false,
      players: [],
      pendingAvatars: {},
    },
    {
      lobbyId: 'lobby-2',
      gameId: '1',
      game: mockGame,
      hostSocketId: 'socket-2',
      playerCount: 3,
      isLocked: false,
      players: [],
      pendingAvatars: {},
    },
  ];

  // Helper: Simulate random network latency between 500ms-5000ms for realistic async testing
  const randomNetworkLatency = (): number => {
    return Math.random() * BASE_4500 + BASE_500; // 500ms to 5000ms
  };

  // Helper: Track WebSocket events with timing information for advanced testing
  const createWebSocketMockWithEventTracking = () => {
    const eventLog: { event: string; timestamp: number; callback?: unknown }[] = [];
    const mock = jasmine.createSpyObj(
      'WebSocketService',
      ['onNamespace', 'offNamespace', 'emitNamespace'],
    );

    // Enhanced mock: track event registrations and support network latency simulation
    mock.onNamespace.and.callFake((namespace: string, event: string, callback: unknown) => {
      eventLog.push({ event, timestamp: Date.now(), callback });
    });

    return { mock, eventLog };
  };

  beforeEach(async () => {
    const { mock: webSocketServiceMock } = createWebSocketMockWithEventTracking();

    await TestBed.configureTestingModule({
      imports: [JoinGamePageComponent],
      providers: [
        provideRouter([]),
        { provide: WebSocketService, useValue: webSocketServiceMock },
      ],
    }).compileComponents();

    webSocketService = TestBed.inject(WebSocketService) as jasmine.SpyObj<WebSocketService>;
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(JoinGamePageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Component initialization and WebSocket event listeners
  describe('ngOnInit', () => {
    // ========================================================================
    // Event Listener Registration Tests
    // ========================================================================
    // These tests verify that ngOnInit correctly subscribes to two WebSocket
    // events: UpdatedLobbiesList (array of lobbies) and LobbyJoined (single
    // lobby). Both events are critical for the join game flow.

    // Test listener setup for lobby updates
    it('should set up listener for UpdatedLobbiesList event', () => {
      fixture.detectChanges();

      expect(webSocketService.onNamespace).toHaveBeenCalledWith(
        SocketNamespace.Join,
        JoinGameEvents.UpdatedLobbiesList,
        jasmine.any(Function),
      );
    });

    it('should update activeLobbies when UpdatedLobbiesList event is received', (done) => {
      let listenerCallback: ((lobbies: Lobby[]) => void) | undefined;

      webSocketService.onNamespace.and.callFake(
        (_namespace: string, event: string, callback: unknown) => {
          if (event === JoinGameEvents.UpdatedLobbiesList) {
            listenerCallback = callback as ((lobbies: Lobby[]) => void);
          }
        },
      );

      fixture.detectChanges();

      expect(component.activeLobbies).toEqual([]);

      // Simulate network latency before event arrival
      setTimeout(() => {
        listenerCallback?.(mockLobbies);
        expect(component.activeLobbies).toEqual(mockLobbies);
        done();
      }, randomNetworkLatency());
    });

    // Test listener setup for joining lobby
    it('should set up listener for LobbyJoined event', () => {
      fixture.detectChanges();

      expect(webSocketService.onNamespace).toHaveBeenCalledWith(
        SocketNamespace.Join,
        JoinGameEvents.LobbyJoined,
        jasmine.any(Function),
      );
    });

    it('should navigate to waiting room when LobbyJoined event is received', (done) => {
      let lobbyJoinedCallback: ((lobby: Lobby) => void) | undefined;

      webSocketService.onNamespace.and.callFake(
        (_namespace: string, _event: string, callback: unknown) => {
          if (_event === JoinGameEvents.LobbyJoined) {
            lobbyJoinedCallback = callback as ((lobby: Lobby) => void);
          }
        },
      );

      spyOn(router, 'navigate');
      fixture.detectChanges();

      const testLobby = mockLobbies[0];

      // Simulate network latency before event arrival
      setTimeout(() => {
        lobbyJoinedCallback?.(testLobby);

        expect(router.navigate).toHaveBeenCalledWith(
          [component.routes.waitingRoom, testLobby.lobbyId],
          { state: { lobby: testLobby } },
        );
        done();
      }, randomNetworkLatency());
    });

    // ========================================================================
    // Synchronization and Initialization Tests
    // ========================================================================
    // These tests verify the component properly initializes by requesting
    // lobby data and ensuring both listeners are attached exactly twice
    // (no duplicate subscriptions causing memory leaks).

    // Test event emission for fetching available lobbies
    it('should emit GetLobbies event on init', () => {
      fixture.detectChanges();

      expect(webSocketService.emitNamespace).toHaveBeenCalledWith(
        SocketNamespace.Join,
        JoinGameEvents.GetLobbies,
      );
    });

    it('should call onNamespace twice for both event listeners', () => {
      fixture.detectChanges();

      expect(webSocketService.onNamespace).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================================================
  // Subscription Cleanup Tests
  // ========================================================================
  // These tests verify that ngOnDestroy properly unsubscribes from both
  // WebSocket listeners. Proper cleanup prevents memory leaks and ensures
  // old event handlers don't fire after component is destroyed.

  // Test cleanup of WebSocket event listeners
  describe('ngOnDestroy', () => {
    it('should unsubscribe from UpdatedLobbiesList listener', () => {
      fixture.detectChanges();
      fixture.destroy();

      expect(webSocketService.offNamespace).toHaveBeenCalledWith(
        SocketNamespace.Join,
        JoinGameEvents.UpdatedLobbiesList,
      );
    });

    it('should unsubscribe from LobbyJoined listener', () => {
      fixture.detectChanges();
      fixture.destroy();

      expect(webSocketService.offNamespace).toHaveBeenCalledWith(
        SocketNamespace.Join,
        JoinGameEvents.LobbyJoined,
      );
    });

    it('should call offNamespace twice for cleanup', () => {
      fixture.detectChanges();
      fixture.destroy();

      expect(webSocketService.offNamespace).toHaveBeenCalledTimes(2);
    });
  });

  // Test lobby selection and navigation to character creation
  describe('selectLobby', () => {
    // ========================================================================
    // Navigation and State Passing Tests
    // ========================================================================
    // These tests verify the selectLobby() method which is called when a user
    // clicks on a lobby in the UI. The method must navigate to character
    // selection with the lobbyId as a route parameter and the Game object
    // in the router state for the next component.

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should navigate to character-selection with lobbyId parameter', () => {
      spyOn(router, 'navigate');
      const testLobby = mockLobbies[0];

      component.selectLobby(testLobby);

      expect(router.navigate).toHaveBeenCalledWith(
        ['/character-selection', testLobby.lobbyId],
        { state: { game: testLobby.game } },
      );
    });

    it('should pass game in state when navigating', () => {
      spyOn(router, 'navigate');
      const testLobby = mockLobbies[1];

      component.selectLobby(testLobby);

      const callArgs = (router.navigate as jasmine.Spy).calls.mostRecent().args;
      expect(callArgs[1]?.state?.game).toEqual(testLobby.game);
    });

    it('should navigate with correct route path', () => {
      spyOn(router, 'navigate');
      const testLobby = mockLobbies[0];

      component.selectLobby(testLobby);

      const callArgs = (router.navigate as jasmine.Spy).calls.mostRecent().args;
      expect(callArgs[0]).toEqual(['/character-selection', testLobby.lobbyId]);
    });
  });

  // Test activeLobbies property updates from WebSocket events
  describe('activeLobbies property', () => {
    // ========================================================================
    // Component State Management Tests
    // ========================================================================
    // These tests verify that activeLobbies property correctly represents
    // the current state of available lobbies. Initially empty, it updates
    // whenever UpdatedLobbiesList WebSocket event is received. This property
    // drives the UI rendering of the lobby list.

    // Test property initialization
    it('should initialize as empty array', () => {
      expect(component.activeLobbies).toEqual([]);
    });

    // Test property updates from events
    it('should be updated when UpdatedLobbiesList event is received', (done) => {
      let listenerCallback: ((lobbies: Lobby[]) => void) | undefined;

      webSocketService.onNamespace.and.callFake(
        (_namespace: string, _event: string, callback: unknown) => {
          if (_event === JoinGameEvents.UpdatedLobbiesList) {
            listenerCallback = callback as ((lobbies: Lobby[]) => void);
          }
        },
      );

      fixture.detectChanges();

      // Simulate network latency before event arrival
      setTimeout(() => {
        listenerCallback?.(mockLobbies);

        expect(component.activeLobbies.length).toBe(2);
        expect(component.activeLobbies[0].lobbyId).toBe('lobby-1');
        expect(component.activeLobbies[1].lobbyId).toBe('lobby-2');
        done();
      }, randomNetworkLatency());
    });
  });
});
