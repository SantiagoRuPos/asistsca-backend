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

  // Evidencia adjunta (2026-09-23, pedido explícito del usuario): mismo
  // patrón de adjuntos ya usado en excusas (PDF/JPG/PNG, 5MB, ver
  // ExcusasController) — se guarda la URL de descarga y el nombre original,
  // nunca el archivo en la base de datos. Opcional: se permite autorizar sin
  // adjuntar nada, por si la evidencia se entrega en papel.
  // "type" explícito: sin esto, TypeORM intenta inferir el tipo de columna
  // por reflexión desde el tipo de TypeScript, y para un tipo unión como
  // "string | null" reflect-metadata solo reporta "Object" — eso rompe el
  // arranque con DataTypeNotSupportedError en Postgres. Mismo patrón que
  // Excusa.archivoSoporteUrl/archivoSoporteNombre en excusa.entity.ts (el
  // ejemplo que debí haber copiado desde el principio).
  @Column({ name: 'evidencia_url', type: 'text', nullable: true })
  evidenciaUrl!: string | null;

  @Column({ name: 'evidencia_nombre', type: 'varchar', length: 255, nullable: true })
  evidenciaNombre!: string | null;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro!: Date;
}