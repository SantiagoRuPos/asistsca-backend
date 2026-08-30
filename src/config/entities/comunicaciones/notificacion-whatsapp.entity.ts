import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Estudiante } from '../academico/estudiante.entity';
import { Acudiente } from '../academico/acudiente.entity';
import { Estado } from '../catalogos/estado.entity';
import { EventoAsistencia } from '../nfc/evento-asistencia.entity';
import { Comunicado } from './comunicado.entity';

@Entity('notificaciones_whatsapp')
export class NotificacionWhatsapp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'estudiante_id',
    type: 'uuid',
  })
  estudianteId!: string;

  @ManyToOne(() => Estudiante)
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @Column({
    name: 'acudiente_id',
    type: 'uuid',
  })
  acudienteId!: string;

  @ManyToOne(() => Acudiente)
  @JoinColumn({ name: 'acudiente_id' })
  acudiente!: Acudiente;

  @Column({
    name: 'tipo_mensaje',
    type: 'varchar',
    length: 60,
  })
  tipoMensaje!: string;

  @Column({
    name: 'estado_id',
    type: 'uuid',
  })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @Column({
    name: 'whatsapp_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  whatsappMessageId!: string | null;

  @Column({
    name: 'fecha_envio',
    type: 'timestamptz',
    nullable: true,
  })
  fechaEnvio!: Date | null;

  @Column({
    name: 'origen_evento_id',
    type: 'uuid',
    nullable: true,
  })
  origenEventoId!: string | null;

  @ManyToOne(() => EventoAsistencia, {
    nullable: true,
  })
  @JoinColumn({ name: 'origen_evento_id' })
  origenEvento!: EventoAsistencia | null;

  @Column({
    name: 'origen_comunicado_id',
    type: 'uuid',
    nullable: true,
  })
  origenComunicadoId!: string | null;

  @ManyToOne(() => Comunicado, {
    nullable: true,
  })
  @JoinColumn({ name: 'origen_comunicado_id' })
  origenComunicado!: Comunicado | null;
}