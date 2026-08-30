import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Usuario } from '../usuarios/usuario.entity';

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'usuario_id',
    type: 'uuid',
    nullable: true,
  })
  usuarioId!: string | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  accion!: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 60,
  })
  entidad!: string;

  @Index()
  @Column({
    name: 'entidad_id',
    type: 'uuid',
    nullable: true,
  })
  entidadId!: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  detalle!: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ip!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  fecha!: Date;
}