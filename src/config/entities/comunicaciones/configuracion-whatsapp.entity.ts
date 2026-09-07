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

  // Antes había una sola columna 'idioma_plantilla' compartida entre las dos
  // plantillas. Se separó en dos (2026-09-07) porque en la práctica cada
  // plantilla se aprueba en Meta con su propio idioma de forma independiente
  // (el usuario terminó con "entrada" en Spanish (COL) y "salida" en English
  // por accidente, y Meta no deja cambiar el idioma de una plantilla activa
  // sin esperar su ventana de reaprobación) — cada una necesita poder tener
  // el suyo sin depender de que coincidan.
  @Column({ name: 'idioma_plantilla_entrada', length: 10, default: 'es_CO' })
  idiomaPlantillaEntrada!: string;

  @Column({ name: 'idioma_plantilla_salida', length: 10, default: 'es_CO' })
  idiomaPlantillaSalida!: string;

  @Column({ name: 'actualizado_por_usuario_id' })
  actualizadoPorUsuarioId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'actualizado_por_usuario_id' })
  actualizadoPorUsuario!: Usuario;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;
}