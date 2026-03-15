export enum GameSessionEvents {
    // Game lifecycle
    StartGame = 'startGame',
    GameStarted = 'gameStarted',
    GameOver = 'gameOver',

    // Turn management
    TurnStarted = 'turnStarted',
    TurnCountdown = 'turnCountdown',
    TurnEnded = 'turnEnded',
    RequestEndTurn = 'requestEndTurn',

    // Movement
    RequestMove = 'requestMove',
    PlayerMoved = 'playerMoved',
    ReachableTiles = 'reachableTiles',

    // Combat
    RequestCombat = 'requestCombat',
    CombatResult = 'combatResult',

    // Player status
    PlayerAbandoned = 'playerAbandoned',

    // Info
    RequestTileInfo = 'requestTileInfo',
    TileInfo = 'tileInfo',
}
