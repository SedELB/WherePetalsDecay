import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Game, gameSchema } from '@app/model/schema/game.schema';
import { CourseController } from '@app/controllers/course/course.controller';
import { CourseService } from '@app/services/course/course.service';
import { DateController } from '@app/controllers/date/date.controller';
import { DateService } from '@app/services/date/date.service';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { ExampleService } from '@app/services/example/example.service';
import { ExampleController } from '@app/controllers/example/example.controller';
import { GameService } from './services/game/game.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
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
    providers: [GameService, Logger],

})
export class AppModule {}
