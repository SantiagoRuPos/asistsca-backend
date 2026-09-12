import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Fila única (singleton) que guarda el estado de la licencia comercial de esta
 * instalación de AsistSCA. No se relaciona con ninguna entidad de negocio
 * (estudiantes, asistencia, NFC, etc.) a propósito: el módulo de licenciamiento
 * es aislado y no debe tocar ni depender del resto del esquema.
 *
 * `fingerprintSellado` se fija la PRIMERA vez que un token de licencia valida
 * correctamente en este servidor y nunca se vuelve a sobreescribir sola —
 * si el fingerprint calculado del servidor cambia después (migración, cambio
 * de hardware/VM), las validaciones futuras fallarán aunque el token siga
 * vigente, exactamente como pide el plan ("requiere reautorización manual de
 * SCA para migraciones legítimas"). En Fase 1, sin servidor de licencias real,
 * la única forma de "reautorizar" es borrar esta fila o su campo sellado a
 * mano en la base de datos — Fase 2 lo hará desde el panel de SCA.
 */
@Entity('licencia_estado')
export class LicenciaEstado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Texto crudo del último token que se intentó cargar (válido o no) — solo
  // para diagnóstico manual, nunca se expone tal cual por API.
  @Column({ type: 'text', nullable: true })
  ultimoTokenCrudo!: string | null;

  @Column({ name: 'fingerprint_sellado', type: 'varchar', length: 64, nullable: true })
  fingerprintSellado!: string | null;

  @Column({ name: 'fecha_sellado', type: 'timestamp', nullable: true })
  fechaSellado!: Date | null;

  @Column({ name: 'fecha_ultima_validacion_exitosa', type: 'timestamp', nullable: true })
  fechaUltimaValidacionExitosa!: Date | null;

  @Column({ name: 'fecha_expiracion_token', type: 'timestamp', nullable: true })
  fechaExpiracionToken!: Date | null;

  @Column({ name: 'cliente_codigo', type: 'varchar', length: 120, nullable: true })
  clienteCodigo!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  plan!: string | null;

  @Column({ name: 'modulos_habilitados', type: 'jsonb', nullable: true })
  modulosHabilitados!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  limites!: Record<string, number> | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn!: Date;
}
