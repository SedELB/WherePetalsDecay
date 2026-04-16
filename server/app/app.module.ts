import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './controllers/game/game.controller';
import { AdminGateway } from './gateways/admin/admin.gateway';
import { GameCatalogGateway } from './gateways/game-catalog/game-catalog.gateway';
import { GameGateway } from './gateways/game/game.gateway';
import { JoinGateway } from './gateways/join/join.gateway';
import { Game, gameSchema } from './model/schema/game.schema';
import { AbandonService } from './services/game-logic/core/abandon.service';
import { ChatFlowService } from './services/game-logic/core/chat-flow.service';
import { CombatFlowService } from './services/game-logic/core/combat-flow.service';
import { CombatStateService } from './services/game-logic/core/combat-state.service';
import { CombatService } from './services/game-logic/core/combat.service';
import { CTFService } from './services/game-logic/core/ctf.service';
import { FlagTransferFlowService } from './services/game-logic/core/flag-transfer-flow.service';
import { GameActionService } from './services/game-logic/core/game-action.service';
import { GameFlowService } from './services/game-logic/core/game-flow.service';
import { GameLogicService } from './services/game-logic/core/game-logic.service';
import { GameManagerService } from './services/game-logic/core/game-manager.service';
import { GameSetupService } from './services/game-logic/core/game-setup.service';
import { GameStatsService } from './services/game-logic/core/game-stats.service';
import { GameTurnSyncService } from './services/game-logic/core/game-turn-sync.service';
import { JoinFlowService } from './services/game-logic/core/join-flow.service';
import { JournalBroadcastService } from './services/game-logic/core/journal-broadcast.service';
import { MovementFlowService } from './services/game-logic/core/movement-flow.service';
import { MovementService } from './services/game-logic/core/movement.service';
import { SanctuaryService } from './services/game-logic/core/sanctuary.service';
import { TurnService } from './services/game-logic/core/turn.service';
import { VirtualPlayerActionService } from './services/game-logic/virtual-player/virtual-player-action.service';
import { VirtualPlayerCombatService } from './services/game-logic/virtual-player/virtual-player-combat.service';
import { VirtualPlayerCtfService } from './services/game-logic/virtual-player/virtual-player-ctf.service';
import { VirtualPlayerMovementService } from './services/game-logic/virtual-player/virtual-player-movement.service';
import { VirtualPlayerPathfindingService } from './services/game-logic/virtual-player/virtual-player-pathfinding.service';
import { VirtualPlayerProfileService } from './services/game-logic/virtual-player/virtual-player-profile.service';
import { VirtualPlayerSanctuaryService } from './services/game-logic/virtual-player/virtual-player-sanctuary.service';
import { VirtualPlayerScannerService } from './services/game-logic/virtual-player/virtual-player-scanner.service';
import { VirtualPlayerService } from './services/game-logic/virtual-player/virtual-player.service';
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
        // Domain services
        GameService,
        GameValidatorService,
        LobbyService,
        JournalService,
        // Game-logic core
        TurnService,
        MovementService,
        CombatService,
        SanctuaryService,
        CTFService,
        GameSetupService,
        GameStatsService,
        GameManagerService,
        GameActionService,
        AbandonService,
        GameLogicService,
        GameTurnSyncService,
        CombatStateService,
        CombatFlowService,
        // Flow services (gateway orchestration)
        JoinFlowService,
        ChatFlowService,
        JournalBroadcastService,
        GameFlowService,
        MovementFlowService,
        FlagTransferFlowService,
        // Virtual player
        VirtualPlayerPathfindingService,
        VirtualPlayerScannerService,
        VirtualPlayerMovementService,
        VirtualPlayerCombatService,
        VirtualPlayerSanctuaryService,
        VirtualPlayerCtfService,
        VirtualPlayerProfileService,
        VirtualPlayerActionService,
        VirtualPlayerService,
        // Gateways
        AdminGateway,
        GameCatalogGateway,
        JoinGateway,
        GameGateway,
        Logger,
    ],
})
export class AppModule {}
