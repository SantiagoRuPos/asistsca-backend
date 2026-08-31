import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';

export enum EntornoWhatsapp {
  PRUEBA = 'prueba',
  PRODUCCION = 'produccion',
}

@Entity('configuracion_whatsapp')
export class ConfiguracionWhatsapp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: EntornoWhatsapp, default: EntornoWhatsapp.PRUEBA })
  entorno!: EntornoWhatsapp;

  @Column({ name: 'phone_number_id', length: 60 })
  phoneNumberId!: string;

  @Column({ name: 'access_token_cifrado', type: 'text' })
  accessTokenCifrado!: string;

  @Column({ name: 'api_version', length: 10, default: 'v21.0' })
  apiVersion!: string;

  @Column({ name: 'plantilla_entrada', length: 120, default: 'hello_world' })
  plantillaEntrada!: string;

  @Column({ name: 'plantilla_salida', length: 120, default: 'hello_world' })
  plantillaSalida!: string;

  @Column({ name: 'idioma_plantilla', length: 10, default: 'en_US' })
  idiomaPlantilla!: string;

  @Column({ name: 'actualizado_por_usuario_id' })
  actualizadoPorUsuarioId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'actualizado_por_usuario_id' })
  actualizadoPorUsuario!: Usuario;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;
}