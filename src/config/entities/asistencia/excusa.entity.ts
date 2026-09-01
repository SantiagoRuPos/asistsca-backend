import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Estudiante } from '../academico/estudiante.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Estado } from '../catalogos/estado.entity';

@Entity('excusas')
export class Excusa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'estudiante_id' })
  estudianteId!: string;

  @ManyToOne(() => Estudiante)
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante;

  @Column({ name: 'fecha_ausencia', type: 'date' })
  fechaAusencia!: string;

  @Column({ type: 'text' })
  motivo!: string;

  @Column({ name: 'tipo_excusa', length: 60 })
  tipoExcusa!: string;

  @Column({ name: 'registrado_por_usuario_id' })
  registradoPorUsuarioId!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'registrado_por_usuario_id' })
  registradoPorUsuario!: Usuario;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro!: Date;

  @Column({ name: 'estado_id' })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @Column({ name: 'archivo_soporte_url', type: 'text', nullable: true })
  archivoSoporteUrl!: string | null;

  @Column({ name: 'archivo_soporte_nombre', type: 'varchar', length: 255, nullable: true })
  archivoSoporteNombre!: string | null;
}