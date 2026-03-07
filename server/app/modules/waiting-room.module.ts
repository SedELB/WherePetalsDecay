import { Logger, Module } from '@nestjs/common';
import { WaitingRoomGateway } from '@app/gateways/waiting-room/waiting-room.gateway';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';

@Module({
    providers: [WaitingRoomGateway, WaitingRoomService, Logger],
    exports: [WaitingRoomService],
})
export class WaitingRoomModule {}
