import { GameController } from '@app/controllers/game/game.controller';
import { Game, gameSchema } from '@app/model/schema/game.schema';
import { GameService } from '@app/services/game/game.service';
import { GameValidatorService } from '@app/services/game/gameValidator.service';
import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Encapsulates the Game logic.
@Module({
    imports: [
        MongooseModule.forFeature([{name: Game.name, schema: gameSchema}]),
    ],
    controllers: [GameController],
    providers: [GameService, GameValidatorService, Logger],
    exports: [GameService], // Seul GameService sera accessible a lexterieur.
})
export class GameModule {}

