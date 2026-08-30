import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Estudiante } from './estudiante.entity';
import { Curso } from './curso.entity';
import { Estado } from '../catalogos/estado.entity';

@Entity('matriculas')
export class Matricula {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'estudiante_id' })
  estudianteId!: string;

  @ManyToOne(() => Estudiante, (estudiante) => estudiante.matriculas)
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @Column({ name: 'curso_id' })
  cursoId!: string;

  @ManyToOne(() => Curso, (curso) => curso.matriculas)
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso;

  @Column({ name: 'año_lectivo', type: 'int' })
  anioLectivo!: number;

  @CreateDateColumn({ name: 'fecha_matricula' })
  fechaMatricula!: Date;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;
}