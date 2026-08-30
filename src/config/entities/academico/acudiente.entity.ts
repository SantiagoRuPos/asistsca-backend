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

  @OneToMany(
    () => EstudianteAcudiente,
    (ea) => ea.acudiente,
  )
  estudiantes!: EstudianteAcudiente[];
}