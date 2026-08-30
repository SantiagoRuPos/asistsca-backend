import { Client } from 'pg';
import { Logger } from '@nestjs/common';

const logger = new Logger('EnsureDatabase');

const NOMBRE_BASE_DATOS_VALIDO = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export interface ConexionAdminPostgres {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
}


export async function asegurarBaseDeDatos(
  admin: ConexionAdminPostgres,
  nombreBaseDatos: string,
): Promise<void> {
  if (!NOMBRE_BASE_DATOS_VALIDO.test(nombreBaseDatos)) {
    throw new Error(
      `DB_DATABASE="${nombreBaseDatos}" no es un nombre de base de datos valido ` +
        '(solo letras, numeros y guion bajo, sin empezar con numero). Revisa tu .env.',
    );
  }

  const client = new Client({
    host: admin.host,
    port: admin.port,
    user: admin.username,
    password: admin.password,
    database: 'postgres',
    ssl: admin.ssl,
  });

  await client.connect();

  try {
    const resultado = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      nombreBaseDatos,
    ]);

    if ((resultado.rowCount ?? 0) > 0) {
      logger.log(`Base de datos "${nombreBaseDatos}" ya existe, no se toca.`);
      return;
    }


    await client.query(`CREATE DATABASE "${nombreBaseDatos}"`);
    logger.log(`Base de datos "${nombreBaseDatos}" no existia - se creo.`);
  } finally {
    await client.end();
  }
}