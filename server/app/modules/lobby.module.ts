import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { JoinGateway } from '@app/gateways/join/join.gateway';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Logger, Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [
    JoinGateway,
    LobbyService,
    Logger,
    ChatGateway,
  ],
  exports: [LobbyService],
})
export class LobbyModule {}