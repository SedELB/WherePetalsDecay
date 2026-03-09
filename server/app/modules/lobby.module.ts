import { LobbyService } from '@app/services/lobby/lobby.service';
import { Logger, Module } from '@nestjs/common';

@Module({
    imports: [],
    providers: [LobbyService, Logger],
    exports: [LobbyService],
})
export class LobbyModule {}
