import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './controllers/game/game.controller';
import { AdminGateway } from './gateways/admin/admin.gateway';
import { ChatGateway } from './gateways/chat/chat.gateway';
import { GameCatalogGateway } from './gateways/game-catalog/game-catalog.gateway';
import { GameTurnSyncService } from './gateways/game/game-turn-sync.service';
import { GameGateway } from './gateways/game/game.gateway';
import { JoinGateway } from './gateways/join/join.gateway';
import { JournalGateway } from './gateways/journal/journal.gateway';
import { Game, gameSchema } from './model/schema/game.schema';
import { CombatService } from './services/game-logic/combat.service';
import { CTFService } from './services/game-logic/ctf.service';
import { GameLogicService } from './services/game-logic/game-logic.service';
import { GameSetupService } from './services/game-logic/game-setup.service';
import { GameStatsService } from './services/game-logic/game-stats.service';
import { MovementService } from './services/game-logic/movement.service';
import { SanctuaryService } from './services/game-logic/sanctuary.service';
import { TurnService } from './services/game-logic/turn.service';
import { VirtualPlayerPathfindingService } from './services/game-logic/virtual-player-pathfinding.service';
import { VirtualPlayerScannerService } from './services/game-logic/virtual-player-scanner.service';
import { VirtualPlayerService } from './services/game-logic/virtual-player.service';
import { GameValidatorService } from './services/game/game-validator.service';
import { GameService } from './services/game/game.service';
import { JournalService } from './services/journal/journal.service';
import { LobbyService } from './services/lobby/lobby.service';
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
        SanctuaryService,

        CTFService,
        GameSetupService,
        GameStatsService,
        GameLogicService,
        JournalService,
        GameTurnSyncService,
        VirtualPlayerService,
        VirtualPlayerPathfindingService,
        VirtualPlayerScannerService,

        // Gateways
        AdminGateway,
        GameGateway,
        GameCatalogGateway,
        JoinGateway,
        ChatGateway,
        JournalGateway,

        Logger,
    ],
})
export class AppModule {}
