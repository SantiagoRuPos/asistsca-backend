import { parsearDuracionMs } from '../common/utils/duracion.util';

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
  // Primer admin creado automaticamente al arrancar si no existe aun
  // ningun usuario con ese correo (ver admin-seeder.service.ts) -- null
  // si no se configuraron, y entonces no se crea nada solo.
  adminBootstrap: {
    email: string | null;
    password: string | null;
  };
  cookies: {
    // El refresh token viaja en una cookie httpOnly (no accesible desde JS,
    // ver auth.controller.ts) en vez de en el cuerpo de la respuesta/localStorage.
    // secure=true exige HTTPS: por defecto se activa solo en producción para no
    // romper el desarrollo local en http://localhost. sameSite='lax' basta
    // mientras frontend y backend compartan el mismo "site" (mismo dominio
    // registrable, aunque cambie el puerto o el subdominio) — si algún día se
    // despliegan en dominios registrables distintos, hace falta
    // COOKIE_SAME_SITE=none (y por lo tanto COOKIE_SECURE=true, exigido por
    // los navegadores para SameSite=None).
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    refreshMaxAgeMs: number;
    // Ver auth.controller.ts: a qué "path" se acota la cookie del refresh
    // token. Por defecto '/auth' (llamada directa backend<->frontend). Si
    // un reverse proxy expone la API bajo un prefijo (p. ej. Nginx
    // canalizando /api/* -> backend, ver docker-compose de producción),
    // el navegador solo ve rutas como /api/auth/refresh y hay que poner
    // COOKIE_AUTH_PATH=/api/auth para que la cookie se siga enviando.
    authPath: string;
  };
  licencia: {
    // Rutas relativas a process.cwd() (raíz del backend en ejecución).
    publicKeyPath: string;
    tokenPath: string;
    // Placeholder — el servidor de licencias real (Fase 2) todavía no existe.
    servidorUrl: string;
    diasAviso: number;
    diasDegradacionAdicional: number;
    // Gracia corta para una instalación que JAMÁS ha validado una licencia
    // (nueva, o alguien con un token falso/copiado de otro servidor) — no
    // debe recibir el mismo colchón de 22 días que un cliente real cuya
    // renovación falló. Ver LicenciaTokenService.calcularEstadoDeGracia.
    diasGraciaPrimeraActivacion: number;
    // Chat de Telegram (de SCA, no del colegio) que recibe un aviso
    // automático cuando esta instalación pasa a 'aviso' o 'degradada' (y
    // otro cuando se recupera). null si no se configuró — la función queda
    // apagada sin romper nada. Ver LicenciaTokenService.gestionarAlertaTelegram.
    alertaTelegramChatId: string | null;
  };
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

  adminBootstrap: {
    email: process.env.ADMIN_EMAIL || null,
    password: process.env.ADMIN_PASSWORD || null,
  },

  cookies: {
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ?? 'lax',
    refreshMaxAgeMs: parsearDuracionMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'),
    authPath: process.env.COOKIE_AUTH_PATH ?? '/auth',
  },

  licencia: {
    publicKeyPath: process.env.LICENCIA_PUBLIC_KEY_PATH ?? 'storage/licencia/public-key.pem',
    tokenPath: process.env.LICENCIA_TOKEN_PATH ?? 'storage/licencia/license.jwt',
    servidorUrl: process.env.LICENCIA_SERVIDOR_URL ?? 'https://licencias.scasolutions.com.co/api/renovar',
    diasAviso: parseInt(process.env.LICENCIA_DIAS_AVISO ?? '15', 10),
    diasDegradacionAdicional: parseInt(process.env.LICENCIA_DIAS_DEGRADACION_ADICIONAL ?? '7', 10),
    diasGraciaPrimeraActivacion: parseInt(process.env.LICENCIA_DIAS_GRACIA_PRIMERA_ACTIVACION ?? '3', 10),
    alertaTelegramChatId: process.env.LICENCIA_ALERTA_TELEGRAM_CHAT_ID ?? null,
  },
});