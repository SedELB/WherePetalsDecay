import { GameController } from '@app/controllers/game/game.controller';
import { AdminGateway } from '@app/gateways/admin/admin.gateway';
import { GamesGateway } from '@app/gateways/games/games.gateway';
import { Game, gameSchema } from '@app/model/schema/game.schema';
import { GameService } from '@app/services/game/game.service';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Encapsulates the Game logic.
@Module({
    imports: [MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }])],
    controllers: [GameController],
    providers: [GameService, GameValidatorService, AdminGateway, GamesGateway, Logger],
    exports: [GameService],
})
export class GameModule {}
