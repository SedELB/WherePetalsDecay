import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Game, gameSchema } from '@app/model/schema/game.schema';
import { GameService } from './services/game/game.service';
import { GameValidatorService } from './services/game/gameValidator.service';
import { GameController } from './controllers/game/game.controller';
import { GameMode } from './model/schema/game.constants';
import { GameModule } from './modules/game.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule, GameModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'), // Loaded from .env
            }),
        }),
        MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
    ],
    // controllers: [CourseController, DateController, ExampleController],
    // providers: [ChatGateway, CourseService, DateService, ExampleService, Logger],
    controllers: [],
    providers: [],

})
export class AppModule {}
