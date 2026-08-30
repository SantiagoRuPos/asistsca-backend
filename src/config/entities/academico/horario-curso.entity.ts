import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Curso } from './curso.entity';

@Entity('horarios_curso')
export class HorarioCurso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
    
  @Column({ name: 'curso_id' })
  cursoId!: string;

  @ManyToOne(() => Curso, (curso) => curso.horarios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso;

  @Column({ name: 'dia_semana', type: 'smallint' })
  diaSemana!: number;

  @Column({ name: 'hora_entrada', type: 'time' })
  horaEntrada!: string;

  @Column({ name: 'minutos_tolerancia_tardanza', type: 'smallint', default: 0 })
  minutosToleranciaTardanza!: number;

  @Column({ name: 'hora_salida', type: 'time' })
  horaSalida!: string;
}