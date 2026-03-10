import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { JoinGateway } from '@app/gateways/join/join.gateway';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Logger, Module } from '@nestjs/common';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';

@Module({
  imports: [],
  providers: [
    JoinGateway,
    LobbyService,
    Logger,
    ChatGateway,
    GameLogicService,
  ],
  exports: [LobbyService],
})
export class LobbyModule {}
