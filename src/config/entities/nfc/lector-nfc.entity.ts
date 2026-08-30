import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Exclude } from 'class-transformer';
import { Estado } from '../catalogos/estado.entity';

@Entity('lectores_nfc')
export class LectorNfc {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'codigo_lector',
    type: 'varchar',
    length: 60,
    unique: true,
  })
  codigoLector!: string;

  @Column({
    name: 'descripcion_ubicacion',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  descripcionUbicacion!: string | null;

  @Exclude()
  @Column({
    name: 'api_key_hash',
    type: 'varchar',
    length: 255,
  })
  apiKeyHash!: string;

  @Column({
    name: 'estado_id',
    type: 'uuid',
  })
  estadoId!: string;

  @ManyToOne(() => Estado)
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @CreateDateColumn({
    name: 'fecha_registro',
    type: 'timestamp',
  })
  fechaRegistro!: Date;
}