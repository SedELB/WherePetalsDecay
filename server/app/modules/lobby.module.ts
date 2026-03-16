import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { JoinGateway } from '@app/gateways/join/join.gateway';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Logger, Module, forwardRef } from '@nestjs/common';
import { GameModule } from './game.module';

@Module({
  imports: [forwardRef(() => GameModule)],
  providers: [JoinGateway, ChatGateway, LobbyService, Logger],
  exports: [LobbyService],
})
export class LobbyModule {}
