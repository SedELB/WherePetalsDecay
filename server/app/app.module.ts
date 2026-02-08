import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { Logger, Module } from '@nestjs/common';
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
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        GameModule,
    ],
    controllers: [],
    providers: [ChatGateway, GameGateway, Logger],
})
export class AppModule {}