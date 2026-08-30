import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Rol } from './rol.entity';
import { Estado } from '../catalogos/estado.entity';
import { Profesor } from '../academico/profesor.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 150, unique: true })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'nombre_completo', length: 200 })
  nombreCompleto!: string;

  @Column({ name: 'rol_id' })
  rolId!: string;

  @ManyToOne(() => Rol)
  @JoinColumn({ name: 'rol_id' })
  rol!: Rol;

  @Column({ name: 'profesor_id', nullable: true })
  profesorId!: string | null;

  @ManyToOne(() => Profesor, { nullable: true })
  @JoinColumn({ name: 'profesor_id' })
  profesor!: Profesor | null;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @Column({ name: 'mfa_habilitado', default: false })
  mfaHabilitado!: boolean;

  @Column({ name: 'intentos_fallidos_login', type: 'int', default: 0 })
  intentosFallidosLogin!: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta!: Date | null;

  @Column({ name: 'debe_cambiar_password', default: true })
  debeCambiarPassword!: boolean;

  @Column({ name: 'fecha_ultimo_cambio_password', type: 'timestamptz', nullable: true })
  fechaUltimoCambioPassword!: Date | null;

  @Column({ name: 'ultimo_login', type: 'timestamptz', nullable: true })
  ultimoLogin!: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;
}