import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TarjetaNfc } from './tarjeta-nfc.entity';
import { LectorNfc } from './lector-nfc.entity';

export enum TipoEvento {
  ENTRADA = 'entrada',
  SALIDA = 'salida',
}

@Entity('eventos_asistencia')
export class EventoAsistencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tarjeta_id' })
  tarjetaId!: string;

  @ManyToOne(() => TarjetaNfc)
  @JoinColumn({ name: 'tarjeta_id' })
  tarjeta!: TarjetaNfc;

  @Column({ name: 'lector_id' })
  lectorId!: string;

  @ManyToOne(() => LectorNfc)
  @JoinColumn({ name: 'lector_id' })
  lector!: LectorNfc;

  @Column({ name: 'tipo_evento', type: 'enum', enum: TipoEvento })
  tipoEvento!: TipoEvento;

  @Column({ name: 'timestamp_evento', type: 'timestamptz' })
  timestampEvento!: Date;

  @CreateDateColumn({ name: 'timestamp_recibido' })
  timestampRecibido!: Date;
}