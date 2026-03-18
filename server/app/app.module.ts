import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './controllers/game/game.controller';
import { Game, gameSchema } from './model/schema/game.schema';
import { GameService } from './services/game/game.service';
import { GameValidatorService } from './services/game/game-validator.service';
import { LobbyService } from './services/lobby/lobby.service';
import { GameLogicService } from './services/game-logic/game-logic.service';
import { TurnService } from './services/game-logic/turn.service';
import { MovementService } from './services/game-logic/movement.service';
import { CombatService } from './services/game-logic/combat.service';
import { AdminGateway } from './gateways/admin/admin.gateway';
import { GameGateway } from './gateways/game/game.gateway';
import { GamesGateway } from './gateways/games/games.gateway';
import { JoinGateway } from './gateways/join/join.gateway';
import { ChatGateway } from './gateways/chat/chat.gateway';
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
    ],
    controllers: [
        GameController,
    ],
    providers: [
        // Services
        GameService, 
        GameValidatorService, 
        LobbyService,
        GameLogicService, 
        TurnService, 
        MovementService, 
        CombatService,
        
        // Gateways
        AdminGateway, 
        GameGateway, 
        GamesGateway, 
        JoinGateway, 
        ChatGateway,
        
        Logger,
    ],
})
export class AppModule {}
