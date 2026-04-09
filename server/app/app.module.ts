import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './controllers/game/game.controller';
import { Game, gameSchema } from './model/schema/game.schema';
import { GameService } from './services/game/game.service';
import { GameValidatorService } from './services/game/game-validator.service';
import { LobbyService } from './services/lobby/lobby.service';
import { VirtualPlayerService } from './services/game-logic/virtual-player.service';
import { GameLogicService } from './services/game-logic/game-logic.service';
import { TurnService } from './services/game-logic/turn.service';
import { MovementService } from './services/game-logic/movement.service';
import { CombatService } from './services/game-logic/combat.service';
import { AdminGateway } from './gateways/admin/admin.gateway';
import { ChatGateway } from './gateways/chat/chat.gateway';
import { GameTurnSyncService } from './gateways/game/game-turn-sync.service';
import { GameGateway } from './gateways/game/game.gateway';
import { GamesGateway } from './gateways/games/games.gateway';
import { JoinGateway } from './gateways/join/join.gateway';
import { JournalGateway } from './gateways/journal/journal.gateway';
import { CTFService } from './services/game-logic/ctf.service';
import { GameSetupService } from './services/game-logic/game-setup.service';
import { GameStatsService } from './services/game-logic/game-stats.service';
import { JournalService } from './services/journal/journal.service';
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
    controllers: [GameController],
    providers: [
        // Services
        GameService,
        GameValidatorService,
        LobbyService,
        TurnService,
        MovementService,
        CombatService,
        CTFService,
        GameSetupService,
        GameStatsService,
        GameLogicService,
        JournalService,
        GameTurnSyncService,
        VirtualPlayerService,

        // Gateways
        AdminGateway,
        GameGateway,
        GamesGateway,
        JoinGateway,
        ChatGateway,
        JournalGateway,

        Logger,
    ],
})
export class AppModule {}
