import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Curso } from '../academico/curso.entity';
import { Estudiante } from '../academico/estudiante.entity';
import { Profesor } from '../academico/profesor.entity';
import { Usuario } from '../usuarios/usuario.entity';

export enum TipoComunicado {
  CURSO = 'curso',
  ESTUDIANTE = 'estudiante',
  GLOBAL = 'global',
}

@Entity('comunicados')
export class Comunicado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoComunicado })
  tipo!: TipoComunicado;

  @Column({ name: 'curso_id', nullable: true })
  cursoId!: string | null;

  @ManyToOne(() => Curso, { nullable: true })
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso | null;

  @Column({ name: 'estudiante_id', nullable: true })
  estudianteId!: string | null;

  @ManyToOne(() => Estudiante, { nullable: true })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante | null;

  @Column({ type: 'text' })
  motivo!: string;

  @Column({ type: 'text' })
  mensaje!: string;

  @Column({ name: 'profesor_relacionado_id', nullable: true })
  profesorRelacionadoId!: string | null;

  @ManyToOne(() => Profesor, { nullable: true })
  @JoinColumn({ name: 'profesor_relacionado_id' })
  profesorRelacionado!: Profesor | null;

  @Column({ name: 'creado_por_usuario_id' })
  creadoPorUsuarioId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'creado_por_usuario_id' })
  creadoPorUsuario!: Usuario;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @Column({ name: 'fecha_envio', type: 'timestamptz', nullable: true })
  fechaEnvio!: Date | null;
}