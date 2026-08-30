import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profesor } from '../academico/profesor.entity';
import { Estado } from '../catalogos/estado.entity';
import { EventoAsistencia } from '../nfc/evento-asistencia.entity';

@Entity('asistencia_diaria_profesor')
export class AsistenciaDiariaProfesor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profesor_id' })
  profesorId!: string;

  @ManyToOne(() => Profesor)
  @JoinColumn({ name: 'profesor_id' })
  profesor!: Profesor;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @Column({ name: 'hora_entrada', type: 'timestamptz', nullable: true })
  horaEntrada!: Date | null;

  @Column({ name: 'hora_salida', type: 'timestamptz', nullable: true })
  horaSalida!: Date | null;

  @Column({ name: 'evento_entrada_id', nullable: true })
  eventoEntradaId!: string | null;

  @ManyToOne(() => EventoAsistencia, { nullable: true })
  @JoinColumn({ name: 'evento_entrada_id' })
  eventoEntrada!: EventoAsistencia | null;

  @Column({ name: 'evento_salida_id', nullable: true })
  eventoSalidaId!: string | null;

  @ManyToOne(() => EventoAsistencia, { nullable: true })
  @JoinColumn({ name: 'evento_salida_id' })
  eventoSalida!: EventoAsistencia | null;
}