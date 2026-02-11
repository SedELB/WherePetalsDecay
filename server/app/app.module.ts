import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameModule } from './modules/game.module';

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
        GameModule, // Rend son export GameService injectable ailleurs ex. game.controller.ts
    ],
    // controllers: [CourseController, DateController, ExampleController],
    // providers: [ChatGateway, CourseService, DateService, ExampleService, Logger],
    controllers: [],
    providers: [],

})
export class AppModule {}
