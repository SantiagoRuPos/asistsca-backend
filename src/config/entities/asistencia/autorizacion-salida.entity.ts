import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Estudiante } from '../academico/estudiante.entity';
import { Acudiente } from '../academico/acudiente.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Estado } from '../catalogos/estado.entity';

@Entity('autorizaciones_salida')
export class AutorizacionSalida {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'estudiante_id' })
  estudianteId!: string;

  @ManyToOne(() => Estudiante)
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'hora_autorizada', type: 'time' })
  horaAutorizada!: string;

  @Column({ name: 'acudiente_autoriza_id' })
  acudienteAutorizaId!: string;

  @ManyToOne(() => Acudiente)
  @JoinColumn({ name: 'acudiente_autoriza_id' })
  acudienteAutoriza!: Acudiente;

  @Column({ name: 'nombre_persona_recoge', length: 200 })
  nombrePersonaRecoge!: string;

  @Column({ name: 'autorizado_por_usuario_id' })
  autorizadoPorUsuarioId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'autorizado_por_usuario_id' })
  autorizadoPorUsuario!: Usuario;

  @Column({ type: 'text' })
  motivo!: string;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro!: Date;
}