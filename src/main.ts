import 'reflect-metadata';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { asegurarBaseDeDatos } from './config/database/ensure-database';

async function bootstrap() {

  validateEnv(process.env);
  await asegurarBaseDeDatos(
    {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME!,
      password: process.env.DB_PASSWORD!,
      ssl: process.env.DB_SSL === 'true',
    },
    process.env.DB_DATABASE!,
  );

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: configService.get('corsOrigins', { infer: true }),
    credentials: true,
  });


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableShutdownHooks();

  const port = configService.get('port', { infer: true });
  await app.listen(port);
}

bootstrap();