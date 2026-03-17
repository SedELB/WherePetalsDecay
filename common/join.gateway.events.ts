// Events (language) for communicating between the client and the server.
export enum JoinGameEvents {
    // Broadcast events
    UpdatedLobbiesList = 'updatedLobbiesList',
    GameFull = 'gameFull',
    GameDeleted = 'gameDeleted',
    PlayerJoined = 'playerJoined',
    PlayerLeft = 'playerLeft',
    DebugToggled = 'debugToogled',
    PlayerTeleported = 'playerTeleported',
    BetweenTurnCountdown = 'betweenTurnCountDown',

    // Request events
    CreateLobby = 'createLobby',
    JoinLobby = 'joinLobby',
    GetLobbies = 'getLobbies',
    DeleteLobby = 'deleteLobby',
    GetLobbyStatus = 'getLobbyStatus',
    LeaveLobby = 'leaveLobby',
    SelectAvatar = 'selectAvatar',
    JoinAvatarRoom = 'joinAvatarRoom',
    ToggleLock = 'toggleLock',
    StartGame = 'startGame',
    KickPlayer = 'kickPlayer',
    ChatSendMessage = 'chatSendMessage',
    ChatHistoryRequest = "chatHistoryRequest",
    Teleport = 'teleport',
    ToggleDebugMode = 'toogleDebugMode',

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
    PlayerAction = 'playerAction',
    GameLobbyUpdated = 'gameLobbyUpdated',
    ChatHistorySent = "chatHistorySent",
}

/*
TODO: TO DELETE LATER

Some sequences: 
(click on Créer une partie) -> JoinGateway (emit CreateLobby) -> LobbyService.createLobby() -> JoinGateway (emit GameHosted + UpdatedLobbiesList) -> Client
(click on Joindre une partie) -> JoinGateway (emit GetLobbies) -> LobbyService.getAvailableLobbies() -> JoinGateway (emit LobbiesList) -> Client
(click on Rejoindre in available lobby) -> JoinGateway (emit JoinLobby) -> LobbyService.joinLobby() -> JoinGateway (emit LobbyJoined) -> Client
*/
