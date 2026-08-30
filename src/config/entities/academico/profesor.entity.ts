import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Estado } from '../catalogos/estado.entity';
import { Curso } from './curso.entity';

@Entity('profesores')
export class Profesor {
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
    name: 'numero_documento',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  numeroDocumento!: string;

  @Column({
    type: 'varchar',
    length: 150,
    unique: true,
  })
  email!: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefono!: string | null;

  @Column({
    name: 'estado_id',
    type: 'uuid',
  })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @OneToMany(
    () => Curso,
    (curso) => curso.profesorDirector,
  )
  cursosDirigidos!: Curso[];

  @CreateDateColumn({
    name: 'fecha_registro',
    type: 'timestamp',
  })
  fechaRegistro!: Date;
}