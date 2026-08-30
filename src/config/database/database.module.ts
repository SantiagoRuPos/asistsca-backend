import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../configuration';


@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        host: configService.get('database.host', { infer: true }),
        port: configService.get('database.port', { infer: true }),
        username: configService.get('database.username', { infer: true }),
        password: configService.get('database.password', { infer: true }),
        database: configService.get('database.database', { infer: true }),
        ssl: configService.get('database.ssl', { infer: true }),
        autoLoadEntities: true,
        synchronize: true,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsTableName: 'migraciones_historial',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}