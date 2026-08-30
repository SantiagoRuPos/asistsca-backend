import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { AppConfig } from '../configuration';

@Injectable()
export class DatabaseInitializerService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitializerService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit() {
    const host = this.configService.get('database.host', { infer: true });
    const port = this.configService.get('database.port', { infer: true });
    const username = this.configService.get('database.username', {
      infer: true,
    });
    const password = this.configService.get('database.password', {
      infer: true,
    });
    const database = this.configService.get('database.database', {
      infer: true,
    });
    const ssl = this.configService.get('database.ssl', { infer: true });

    const client = new Client({
      host,
      port,
      user: username,
      password,
      database: 'postgres',
      ssl,
    });

    try {
      await client.connect();

      const result = await client.query(
        `
        SELECT 1
        FROM pg_database
        WHERE datname = $1
        `,
        [database],
      );

      if (result.rowCount === 0) {
        this.logger.log(`Creando base de datos "${database}"...`);

        await client.query(
          `CREATE DATABASE "${database.replace(/"/g, '""')}"`,
        );

        this.logger.log(
          `Base de datos "${database}" creada correctamente`,
        );
      } else {
        this.logger.log(
          `La base de datos "${database}" ya existe`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error verificando o creando la base de datos',
        error,
      );

      throw error;
    } finally {
      await client.end();
    }
  }
}