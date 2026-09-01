import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const ROLES_FILTRABLES = ['admin', 'rector', 'coordinador', 'profesor'] as const;
const ESTADOS_FILTRABLES = ['activo', 'inactivo'] as const;

export class FiltrarUsuariosDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(ROLES_FILTRABLES)
  rol?: (typeof ROLES_FILTRABLES)[number];

  @IsOptional()
  @IsIn(ESTADOS_FILTRABLES)
  estado?: (typeof ESTADOS_FILTRABLES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number = 10;
}
