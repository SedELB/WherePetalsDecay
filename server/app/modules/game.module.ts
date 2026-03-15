import { GameController } from '@app/controllers/game/game.controller';
import { AdminGateway } from '@app/gateways/admin/admin.gateway';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { GamesGateway } from '@app/gateways/games/games.gateway';
import { JoinGateway } from '@app/gateways/join/join.gateway';
import { Game, gameSchema } from '@app/model/schema/game.schema';
import { CombatService } from '@app/services/game-logic/combat.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { MovementService } from '@app/services/game-logic/movement.service';
import { TurnService } from '@app/services/game-logic/turn.service';
import { GameService } from '@app/services/game/game.service';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }])],
    controllers: [GameController],
    providers: [
        GameService, GameValidatorService,
        AdminGateway, GameGateway, GamesGateway, JoinGateway, ChatGateway,
        Logger, LobbyService,
        GameLogicService, TurnService, MovementService, CombatService,
    ],
    exports: [GameService],
})
export class GameModule {}
