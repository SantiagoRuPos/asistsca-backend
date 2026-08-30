import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Estudiante } from './estudiante.entity';
import { Acudiente } from './acudiente.entity';

@Entity('estudiante_acudiente')
export class EstudianteAcudiente {
  @PrimaryColumn({ name: 'estudiante_id' })
  estudianteId!: string;

  @PrimaryColumn({ name: 'acudiente_id' })
  acudienteId!: string;

  @ManyToOne(() => Estudiante, (estudiante) => estudiante.acudientes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @ManyToOne(() => Acudiente, (acudiente) => acudiente.estudiantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'acudiente_id' })
  acudiente!: Acudiente;

  @Column({ name: 'es_contacto_notificacion', default: false })
  esContactoNotificacion!: boolean;
}