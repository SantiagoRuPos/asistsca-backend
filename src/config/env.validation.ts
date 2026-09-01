import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';


class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV!: string;

  @IsOptional()
  @IsNumberString()
  PORT!: string;

  @IsString()
  DB_HOST!: string;

  @IsNumberString()
  DB_PORT!: string;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_DATABASE!: string;

  @IsOptional()
  @IsBooleanString()
  DB_SSL!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres',
  })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsNumberString()
  ACCOUNT_LOCK_MAX_ATTEMPTS!: string;

  @IsNumberString()
  ACCOUNT_LOCK_MINUTES!: string;

  @IsNumberString()
  THROTTLE_TTL_MS!: string;

  @IsNumberString()
  THROTTLE_LIMIT!: string;

  @IsNumberString()
  LOGIN_THROTTLE_TTL_MS!: string;

  @IsNumberString()
  LOGIN_THROTTLE_LIMIT!: string;

  @IsString()
  CORS_ORIGINS!: string;

  @IsNumberString()
  BCRYPT_SALT_ROUNDS!: string;

  // --- SMTP (mailer) ---
  // Opcionales: mientras SMTP_USER/SMTP_PASS no se completen manualmente,
  // el mailer queda inactivo (ver mailer.service.ts) en vez de romper el arranque.
  @IsOptional()
  @IsString()
  SMTP_HOST!: string;

  @IsOptional()
  @IsNumberString()
  SMTP_PORT!: string;

  @IsOptional()
  @IsBooleanString()
  SMTP_SECURE!: string;

  @IsOptional()
  @IsString()
  SMTP_USER!: string;

  @IsOptional()
  @IsString()
  SMTP_PASS!: string;

  @IsOptional()
  @IsString()
  BRAND_NAME!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const mensaje = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join(' | ');
    throw new Error(`Configuracion de entorno invalida. Revisa tu archivo .env: ${mensaje}`);
  }
  return validatedConfig;
}