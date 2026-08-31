import { IsEnum, IsNotEmpty, IsUUID, MaxLength, IsString, ValidateIf } from 'class-validator';
import { TipoTitular } from '../../../config/entities/nfc/tarjeta-nfc.entity';

export class AsignarTarjetaDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  uidTarjeta!: string;

  @IsEnum(TipoTitular, { message: 'tipoTitular debe ser estudiante o profesor' })
  tipoTitular!: TipoTitular;

  @ValidateIf((dto) => dto.tipoTitular === TipoTitular.ESTUDIANTE)
  @IsUUID()
  @IsNotEmpty()
  estudianteId?: string;

  @ValidateIf((dto) => dto.tipoTitular === TipoTitular.PROFESOR)
  @IsUUID()
  @IsNotEmpty()
  profesorId?: string;
}