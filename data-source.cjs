require('dotenv').config();

const { DataSource } = require('typeorm');
const path = require('path');

module.exports = new DataSource({
  type: 'postgres',

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),

  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,

  entities: [
    path.join(
      __dirname,
      'dist/config/entities/**/*.entity.js',
    ),
  ],

  migrations: [
    path.join(
      __dirname,
      'dist/config/database/migrations/*.js',
    ),
  ],

  synchronize: false,

  migrationsTableName: 'migraciones_historial',
});