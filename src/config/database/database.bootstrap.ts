import { Client } from 'pg';

export async function ensureDatabaseExists() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT ?? 5432);
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_DATABASE;

  if (!database) {
    throw new Error('DB_DATABASE no está definido');
  }

  const client = new Client({
    host,
    port,
    user: username,
    password,
    database: 'postgres',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
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
      console.log(`Creando base de datos ${database}...`);

      const safeDatabase = database.replace(/"/g, '""');

      await client.query(
        `CREATE DATABASE "${safeDatabase}"`,
      );

      console.log(`Base de datos ${database} creada.`);
    }
  } finally {
    await client.end();
  }
}