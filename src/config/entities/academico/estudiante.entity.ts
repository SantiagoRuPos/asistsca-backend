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
import { Matricula } from './matricula.entity';
import { EstudianteAcudiente } from './estudiante-acudiente.entity';

@Entity('estudiantes')
export class Estudiante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  nombres!: string;

  @Column({ length: 120 })
  apellidos!: string;

  @Column({ name: 'tipo_documento', length: 20 })
  tipoDocumento!: string;

  @Column({ name: 'numero_documento', length: 30, unique: true })
  numeroDocumento!: string;

  @Column({ name: 'fecha_nacimiento', type: 'date' })
  fechaNacimiento!: string;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @OneToMany(() => Matricula, (matricula) => matricula.estudiante)
  matriculas!: Matricula[];

  @OneToMany(() => EstudianteAcudiente, (ea) => ea.estudiante)
  acudientes!: EstudianteAcudiente[];

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro!: Date;
}