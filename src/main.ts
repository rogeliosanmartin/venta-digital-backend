import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') ?? 3022);

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Venta Digital API escuchando en http://localhost:${port}/api`);
}

bootstrap();
