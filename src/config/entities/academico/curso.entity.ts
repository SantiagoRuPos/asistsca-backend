import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Profesor } from './profesor.entity';
import { Matricula } from './matricula.entity';
import { HorarioCurso } from './horario-curso.entity';

export enum Jornada {
  MANANA = 'mañana',
  TARDE = 'tarde',
  UNICA = 'unica',
}

@Entity('cursos')
export class Curso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 40 })
  nombre!: string;

  @Column({ name: 'año_lectivo', type: 'int' })
  anioLectivo!: number;

  @Column({ name: 'profesor_director_id' })
  profesorDirectorId!: string;

  @ManyToOne(() => Profesor, (profesor) => profesor.cursosDirigidos)
  @JoinColumn({ name: 'profesor_director_id' })
  profesorDirector!: Profesor;

  @Column({ type: 'enum', enum: Jornada, default: Jornada.UNICA })
  jornada!: Jornada;

  @OneToMany(() => Matricula, (matricula) => matricula.curso)
  matriculas!: Matricula[];

  @OneToMany(() => HorarioCurso, (horario) => horario.curso)
  horarios!: HorarioCurso[];
}