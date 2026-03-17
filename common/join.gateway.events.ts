// Events (language) for communicating between the client and the server.
export enum JoinGameEvents {
    // Broadcast events
    UpdatedLobbiesList = 'updatedLobbiesList',
    GameDeleted = 'gameDeleted',

    // Request events
    CreateLobby = 'createLobby',
    JoinLobby = 'joinLobby',
    GetLobbies = 'getLobbies',
    GetLobbyStatus = 'getLobbyStatus',
    LeaveLobby = 'leaveLobby',
    SelectAvatar = 'selectAvatar',
    JoinAvatarRoom = 'joinAvatarRoom',
    ToggleLock = 'toggleLock',
    StartGame = 'startGame',
    KickPlayer = 'kickPlayer',
    ChatSendMessage = 'chatSendMessage',
    ChatHistoryRequest = "chatHistoryRequest",

    // Response events (confirmations)
    GameHosted = 'gameHosted',
    LobbyJoined = 'lobbyJoined',
    LobbyError = 'lobbyError',
    DeletedLobby = 'deletedLobby',
    LobbyStatusReceived = 'lobbyStatusReceived',
    LeftLobby = 'leftLobby',

    UpdateOccupiedAvatars = 'updatedOccupiedAvatars',
    LobbyUpdated = 'lobbyUpdated',
    GameStarting = 'gameStarting',
    PlayerKicked = 'playerKicked',
    ReceivedChatMessage = 'receivedChatMessage',

    //--------Game-View-Events--------
    GameStarted = 'gameStarted',
    TurnCountdown = 'turnCountdown',
    TurnStarted = 'turnStarted',
    TurnEnded = 'turnEnded',
    EndTurn = 'endTurn',
    PlayerAbandon = 'playerAbandon',
    PlayerAbandoned = 'playerAbandoned',
    GameOver = 'gameOver',

    // Movement
    RequestMove = 'requestMove',
    PlayerMoved = 'playerMoved',
    ReachableTiles = 'reachableTiles',
    MovementPoints = 'movementPoints',

    // Combat
    RequestCombat = 'requestCombat',
    CombatResult = 'combatResult',

    // Info
    RequestTileInfo = 'requestTileInfo',
    TileInfo = 'tileInfo',
    GameLobbyUpdated = 'gameLobbyUpdated',
    ChatHistorySent = "chatHistorySent",
}
