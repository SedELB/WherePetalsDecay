export enum WaitingRoomEvents {
    // Client-> Server
    CreateRoom = 'createRoom',
    JoinRoom = 'joinRoom',
    LeaveRoom = 'leaveRoom',
    KickPlayer = 'kickPlayer',
    StartGame = 'startGame',
    ToggleLock = 'toggleLock',

    // Server->Client
    RoomCreated = 'roomCreated',
    RoomJoined = 'roomJoined',
    RoomUpdated = 'roomUpdated',
    PlayerJoined = 'playerJoined',
    PlayerLeft = 'playerLeft',
    PlayerKicked = 'playerKicked',
    RoomLocked = 'roomLocked',
    RoomUnlocked = 'roomUnlocked',
    GameStarting = 'gameStarting',
    RoomClosed = 'roomClosed',
    Error = 'error',
}
