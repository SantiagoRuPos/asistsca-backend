import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EstudianteAcudiente } from './estudiante-acudiente.entity';

export enum Parentesco {
  PADRE = 'padre',
  MADRE = 'madre',
  TUTOR = 'tutor',
  OTRO = 'otro',
}

@Entity('acudientes')
export class Acudiente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 120,
  })
  nombres!: string;

  @Column({
    type: 'varchar',
    length: 120,
  })
  apellidos!: string;

  @Column({
    type: 'enum',
    enum: Parentesco,
  })
  parentesco!: Parentesco;

  @Column({
    name: 'telefono_whatsapp',
    type: 'varchar',
    length: 30,
  })
  telefonoWhatsapp!: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  email!: string | null;

  @Column({
    name: 'numero_documento',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  numeroDocumento!: string | null;

  // (2026-10-15) Autorizacion de tratamiento de datos personales (Ley 1581
  // de 2012 / Habeas Data) otorgada por este acudiente en representacion
  // del menor. El colegio (responsable del tratamiento) es quien recoge
  // esta autorizacion -- aqui solo se registra el hecho y la fecha, para
  // poder demostrarla si se pide. Por defecto false: no se asume autorizado
  // a nadie que no haya dado el consentimiento explicitamente.
  @Column({
    name: 'autorizacion_tratamiento_datos',
    type: 'boolean',
    default: false,
  })
  autorizacionTratamientoDatos!: boolean;

  @Column({
    name: 'fecha_autorizacion_tratamiento',
    type: 'timestamptz',
    nullable: true,
  })
  fechaAutorizacionTratamiento!: Date | null;

  @OneToMany(
    () => EstudianteAcudiente,
    (ea) => ea.acudiente,
  )
  estudiantes!: EstudianteAcudiente[];
}