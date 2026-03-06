import { JoinGateway } from '@app/gateways/join/join.gateway';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Logger, Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [
    JoinGateway,
    LobbyService,
    Logger,
  ],
  exports: [LobbyService],
})
export class LobbyModule {}