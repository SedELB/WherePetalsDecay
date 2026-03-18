import { GameController } from '@app/controllers/game/game.controller';
import { AdminGateway } from '@app/gateways/admin/admin.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { GamesGateway } from '@app/gateways/games/games.gateway';
import { Game, gameSchema } from '@app/model/schema/game.schema';
import { CombatService } from '@app/services/game-logic/combat.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { MovementService } from '@app/services/game-logic/movement.service';
import { TurnService } from '@app/services/game-logic/turn.service';
import { GameService } from '@app/services/game/game.service';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { Logger, Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LobbyModule } from './lobby.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
        forwardRef(() => LobbyModule),
    ],
    controllers: [GameController],
    providers: [
        GameService, GameValidatorService,
        AdminGateway, GameGateway, GamesGateway, Logger,
        GameLogicService, TurnService, MovementService, CombatService,
    ],
    exports: [GameService, GameLogicService],
})
export class GameModule {}
