import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EntornoWhatsapp } from '../../../config/entities/comunicaciones/configuracion-whatsapp.entity';

export class ConfigurarWhatsappDto {
  @IsEnum(EntornoWhatsapp)
  entorno!: EntornoWhatsapp;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  phoneNumberId!: string;

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  apiVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  plantillaEntrada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  plantillaSalida?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  idiomaPlantilla?: string;
}