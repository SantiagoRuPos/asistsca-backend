import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Estudiante } from '../academico/estudiante.entity';
import { Estado } from '../catalogos/estado.entity';
import { EventoAsistencia } from '../nfc/evento-asistencia.entity';
import { Usuario } from '../usuarios/usuario.entity';

export enum OrigenAsistencia {
  NFC_AUTOMATICO = 'nfc_automatico',
  CORRECCION_MANUAL = 'correccion_manual',
}

@Entity('asistencia_diaria')
export class AsistenciaDiaria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'estudiante_id' })
  estudianteId!: string;

  @ManyToOne(() => Estudiante)
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @Column({ name: 'salida_anticipada', default: false })
  salidaAnticipada!: boolean;

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

  @Column({ type: 'enum', enum: OrigenAsistencia, default: OrigenAsistencia.NFC_AUTOMATICO })
  origen!: OrigenAsistencia;

  @Column({ name: 'verificado_por_usuario_id', nullable: true })
  verificadoPorUsuarioId!: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'verificado_por_usuario_id' })
  verificadoPorUsuario!: Usuario | null;

  @Column({ name: 'fecha_verificacion', type: 'timestamptz', nullable: true })
  fechaVerificacion!: Date | null;

  @Column({ name: 'observacion_verificacion', type: 'text', nullable: true })
  observacionVerificacion!: string | null;

  // 2026-09-22: marca si el evadido de este registro ya fue escalado al
  // coordinador desde Telegram (botón "Sí, reportar al coordinador" que
  // ve el director de grupo) — evita notificar dos veces al coordinador
  // si el botón se presiona más de una vez. Solo aplica cuando el estado
  // es "evadido"; en cualquier otro caso queda en false sin significado.
  @Column({ name: 'evadido_escalado_coordinador', default: false })
  evadidoEscaladoCoordinador!: boolean;

  // (2026-09-25) "Deshacer" un registro hecho por error (ej. desde Carnets:
  // Entrada/Salida por accidente al estudiante equivocado). Se guarda un
  // solo nivel de historial -- el estado justo antes de la corrección más
  // reciente -- como JSON, en vez de una tabla de historial aparte, porque
  // solo hace falta poder deshacer el último cambio, no navegar un
  // historial completo. Ver AsistenciaService.registrarManual (quien lo
  // escribe) y deshacerRegistroManual (quien lo consume y lo limpia).
  @Column({ name: 'snapshot_antes_correccion', type: 'text', nullable: true })
  snapshotAntesCorreccion!: string | null;

  // Qué tipoRegistro fue la corrección más reciente (entrada/salida/
  // evadido/etc.) -- necesario para que un profesor solo pueda deshacer
  // los tipos que él mismo puede registrar directamente (mismo criterio
  // que TIPOS_PERMITIDOS_PROFESOR).
  @Column({ name: 'ultimo_tipo_correccion', type: 'varchar', length: 20, nullable: true })
  ultimoTipoCorreccion!: string | null;
}