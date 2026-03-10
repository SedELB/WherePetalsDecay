export enum ChatEvents {
    //MessageSent = 'MessageSent',
    //UserJoinded = 'UserJoined',
    //UserLeft = 'UserLeft',
    //UserKickOut = 'UserKickOut',
    // Client -> Server
    JoinRoom = 'joinRoom',
    LeaveRoom = 'leaveRoom',
    SendMessage = 'sendMessage',

    // Server -> Client
    Message = 'message',
    UserJoined = 'userJoined',
    UserLeft = 'userLeft',

}
