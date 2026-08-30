import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Estado } from '../catalogos/estado.entity';
import { Estudiante } from '../academico/estudiante.entity';
import { Profesor } from '../academico/profesor.entity';

export enum TipoTitular {
  ESTUDIANTE = 'estudiante',
  PROFESOR = 'profesor',
}

@Entity('tarjetas_nfc')
export class TarjetaNfc {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'uid_tarjeta', length: 40, unique: true })
  uidTarjeta!: string;

  @Column({ name: 'tipo_titular', type: 'enum', enum: TipoTitular })
  tipoTitular!: TipoTitular;

  @Column({ name: 'estudiante_id', nullable: true })
  estudianteId!: string | null;

  @ManyToOne(() => Estudiante, { nullable: true })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante!: Estudiante | null;

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

  @CreateDateColumn({ name: 'fecha_asignacion' })
  fechaAsignacion!: Date;
}