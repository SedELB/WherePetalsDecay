import { AppModule } from '@app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const bootstrap = async () => {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    app.enableCors();

    const config = new DocumentBuilder()
        .setTitle('Where Petals Decay Online')
        .setDescription('Multiplayer RPG web app')
        .setVersion('1.0.0')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    SwaggerModule.setup('', app, document);

    // Railway route le trafic vers le conteneur via son réseau privé IPv6 :
    // il faut écouter sur '::' (wildcard IPv6, dual-stack => IPv6 + IPv4),
    // sinon ('0.0.0.0' = IPv4 only) le proxy se prend un "connection refused" -> 502.
    await app.listen(process.env.PORT || 3000, '::');
};

bootstrap();
