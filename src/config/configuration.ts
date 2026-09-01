export interface AppConfig {
  env: string;
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  security: {
    accountLockMaxAttempts: number;
    accountLockMinutes: number;
    bcryptSaltRounds: number;
  };
  throttle: {
    ttlMs: number;
    limit: number;
    loginTtlMs: number;
    loginLimit: number;
  };
  whatsapp: {
    encryptionKey: string;
  };
  smtp: {
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    pass: string | null;
  };
  brand: {
    name: string;
  };
  corsOrigins: string[];
}


export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  security: {
    accountLockMaxAttempts: parseInt(process.env.ACCOUNT_LOCK_MAX_ATTEMPTS ?? '5', 10),
    accountLockMinutes: parseInt(process.env.ACCOUNT_LOCK_MINUTES ?? '15', 10),
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    loginTtlMs: parseInt(process.env.LOGIN_THROTTLE_TTL_MS ?? '60000', 10),
    loginLimit: parseInt(process.env.LOGIN_THROTTLE_LIMIT ?? '5', 10),
  },
  whatsapp: {
    encryptionKey: process.env.WHATSAPP_ENCRYPTION_KEY!,
  },

  // SMTP_USER y SMTP_PASS quedan en null si no se han configurado todavia:
  // el mailer detecta esto y evita enviar correos hasta que se completen.
  smtp: {
    host: process.env.SMTP_HOST ?? null,
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
  },
  brand: {
    name: process.env.BRAND_NAME ?? 'AsistSCA',
  },

  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});